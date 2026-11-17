import { describe, expect, it } from 'vitest';
import { captureRig, instantiateRig } from './rigs';
import { TEMPLATES, gearFromTemplate } from './catalog';
import { proposeConnections } from './autoconnect';
import { cameraConfig } from '@/lib/camera/settings';

const t = (id: string) => gearFromTemplate(TEMPLATES.find((x) => x.id === id)!);

describe('saved rigs', () => {
  it('captures a rig and makes a fresh copy with the same connections and lens', () => {
    const cam = t('body-canon-r50v');
    const lens = { ...t('lens-rf-s-18-45'), rigOf: cam.id };
    cam.camera = { ...cameraConfig(cam), lensGearId: lens.id };
    const cage = { ...t('cage'), rigOf: cam.id };
    const plate = { ...t('vmount-plate'), rigOf: cam.id };
    const other = t('lav');
    const gear = [cam, lens, cage, plate, other];
    const connections = proposeConnections(gear, [], cam.id).map((p) => ({ ...p, notes: '' }));
    const cap = captureRig(cam.id, gear, connections)!;
    expect(cap.parts.map((p) => p.id).sort()).toEqual([lens.id, cage.id, plate.id].sort());
    expect(cap.connections.length).toBeGreaterThan(1);
    const made = instantiateRig(cap, 'Camera B · R50 V rig');
    const ids = new Set(made.gear.map((g) => g.id));
    expect(ids.has(cam.id)).toBe(false);
    expect(made.connections).toHaveLength(cap.connections.length);
    expect(made.connections.every((c) => ids.has(c.fromGear) && ids.has(c.toGear))).toBe(true);
    const newCam = made.gear.find((g) => g.id === made.cameraId)!;
    expect(ids.has(newCam.camera!.lensGearId!)).toBe(true);
    expect(made.gear.filter((g) => g.id !== made.cameraId).every((g) => g.rigOf === made.cameraId)).toBe(true);
    // Ports were renumbered and still line up.
    for (const c of made.connections) {
      expect(made.gear.find((g) => g.id === c.fromGear)!.ports.some((p) => p.id === c.fromPort)).toBe(true);
      expect(made.gear.find((g) => g.id === c.toGear)!.ports.some((p) => p.id === c.toPort)).toBe(true);
    }
  });
});
