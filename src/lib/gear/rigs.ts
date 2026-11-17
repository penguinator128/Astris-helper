import type { Connection, GearItem } from '@/types/project';
import { uid } from '@/lib/id';
import { cameraConfig } from '@/lib/camera/settings';
import { rigKey } from './autoconnect';

/** Everything on a camera's rig, and the connections among them, ready to save. */
export function captureRig(camId: string, gear: GearItem[], connections: Connection[]): { camera: GearItem; parts: GearItem[]; connections: Connection[] } | null {
  const camera = gear.find((g) => g.id === camId && g.category === 'camera');
  if (!camera) return null;
  const lensId = cameraConfig(camera).lensGearId;
  const parts = gear.filter((g) => g.id !== camId && (rigKey(g) === camId || g.id === lensId));
  const ids = new Set([camId, ...parts.map((p) => p.id)]);
  return { camera: structuredClone(camera), parts: structuredClone(parts), connections: structuredClone(connections.filter((c) => ids.has(c.fromGear) && ids.has(c.toGear))) };
}

/** A saved rig as fresh gear for a plan: new ids everywhere, connections and lens kept. */
export function instantiateRig(saved: { camera: GearItem; parts: GearItem[]; connections: Connection[] }, cameraName: string): { gear: GearItem[]; connections: Connection[]; cameraId: string } {
  const map = new Map<string, string>();
  const portMap = new Map<string, string>();
  const copy = (g: GearItem): GearItem => {
    const id = uid();
    map.set(g.id, id);
    return {
      ...structuredClone(g),
      id,
      ports: g.ports.map((p) => {
        const pid = uid();
        portMap.set(`${g.id}:${p.id}`, pid);
        return { ...p, id: pid };
      }),
    };
  };
  const cam = copy(saved.camera);
  const parts = saved.parts.map(copy);
  cam.name = cameraName;
  if (cam.camera?.lensGearId) cam.camera = { ...cam.camera, lensGearId: map.get(cam.camera.lensGearId) };
  for (const p of parts) p.rigOf = cam.id;
  const connections: Connection[] = [];
  for (const c of saved.connections) {
    const fromGear = map.get(c.fromGear);
    const toGear = map.get(c.toGear);
    const fromPort = portMap.get(`${c.fromGear}:${c.fromPort}`);
    const toPort = portMap.get(`${c.toGear}:${c.toPort}`);
    if (fromGear && toGear && fromPort && toPort) connections.push({ ...c, id: uid(), fromGear, toGear, fromPort, toPort });
  }
  return { gear: [cam, ...parts], connections, cameraId: cam.id };
}
