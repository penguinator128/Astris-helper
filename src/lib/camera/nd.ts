import type { CameraConfig, GearItem } from '@/types/project';
import { rigKey } from '@/lib/gear/autoconnect';

/** The ND a camera's rig can give: a variable ND's range, or a fixed filter's strength. */
export function ndOnRig(camId: string, gear: GearItem[]): { min: number; max: number; name: string } | null {
  let best: { min: number; max: number; name: string } | null = null;
  for (const g of gear) {
    if (g.category !== 'filter' || rigKey(g) !== camId) continue;
    const v = g.model.match(/Variable ND\s*(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/i);
    const f = g.model.match(/ND\s*(\d\.\d)/i);
    const r = v ? { min: Number(v[1]), max: Number(v[2]), name: g.name } : f ? { min: (Number(f[1]) * 10) / 3, max: (Number(f[1]) * 10) / 3, name: g.name } : null;
    if (r && (!best || r.max > best.max)) best = r;
  }
  return best;
}

/** Settings with the ND clamped to what is actually on the rig (none if the filter was taken off). */
export function withRigNd(c: CameraConfig, camId: string, gear: GearItem[]): CameraConfig {
  const nd = ndOnRig(camId, gear);
  const want = c.ndStops ?? 0;
  const ndStops = !nd || want <= 0 ? 0 : nd.min === nd.max ? nd.max : Math.min(nd.max, Math.max(nd.min, want));
  return ndStops === want ? c : { ...c, ndStops };
}
