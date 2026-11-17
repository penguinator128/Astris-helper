import type { LensFormat } from '@/types/project';

/**
 * Lens mounts with their flange focal distance (mount face to sensor, mm).
 * A lens can be adapted to a camera when its flange distance is longer than the camera's,
 * because the adapter fills the gap. Published figures.
 */
export const MOUNTS: { id: string; name: string; flange: number }[] = [
  { id: 'RF', name: 'Canon RF / RF-S', flange: 20 },
  { id: 'EF', name: 'Canon EF / EF-S', flange: 44 },
  { id: 'EF-M', name: 'Canon EF-M', flange: 18 },
  { id: 'E', name: 'Sony E / FE', flange: 18 },
  { id: 'Sony A', name: 'Sony A (Minolta A)', flange: 44.5 },
  { id: 'Z', name: 'Nikon Z', flange: 16 },
  { id: 'F', name: 'Nikon F', flange: 46.5 },
  { id: 'L', name: 'L-Mount (Leica, Panasonic, Sigma)', flange: 20 },
  { id: 'X', name: 'Fujifilm X', flange: 17.7 },
  { id: 'GFX', name: 'Fujifilm G', flange: 26.7 },
  { id: 'MFT', name: 'Micro Four Thirds', flange: 19.25 },
  { id: 'K', name: 'Pentax K', flange: 45.46 },
  { id: 'Leica M', name: 'Leica M', flange: 27.8 },
  { id: 'Hasselblad XCD', name: 'Hasselblad XCD', flange: 18.14 },
  { id: 'PL', name: 'Arri PL', flange: 52 },
  { id: 'LPL', name: 'Arri LPL', flange: 44 },
  { id: 'M42', name: 'M42 screw', flange: 45.46 },
  { id: 'C-mount', name: 'C-mount', flange: 17.526 },
  { id: 'Fixed', name: 'Built-in lens', flange: 0 },
];

export function mountInfo(id: string) {
  return MOUNTS.find((m) => m.id === id);
}

export type Fit = { kind: 'native' } | { kind: 'adapter'; note: string } | { kind: 'no'; reason: string } | { kind: 'unknown'; note: string };

/** Can a lens of one mount go on a camera of another, and how? */
export function lensFit(lensMount: string, cameraMount: string): Fit {
  if (!lensMount || !cameraMount) return { kind: 'unknown', note: 'Mount not set' };
  if (lensMount.toLowerCase() === cameraMount.toLowerCase()) return { kind: 'native' };
  if (cameraMount === 'Fixed') return { kind: 'no', reason: 'This camera has a built-in lens' };
  const l = mountInfo(lensMount);
  const c = mountInfo(cameraMount);
  if (!l || !c) return { kind: 'unknown', note: `Check that a ${lensMount} to ${cameraMount} adapter exists` };
  if (l.flange - c.flange >= 1) return { kind: 'adapter', note: `${l.name} lenses sit ${(l.flange - c.flange).toFixed(1)} mm further from the sensor, so a simple adapter fills the gap` };
  return { kind: 'no', reason: `${l.name} lenses need to sit closer to the sensor than a ${c.name} body allows, so they cannot focus to infinity without glass in the adapter` };
}

/** Sensor width covered by each lens format, mm. */
const FORMAT_WIDTH: Record<LensFormat, number> = { medium: 43.8, 'full-frame': 36, s35: 25, 'aps-c': 23.5, mft: 17.3, 'one-inch': 13.2 };

export const LENS_FORMATS: { id: LensFormat; label: string }[] = [
  { id: 'full-frame', label: 'Full frame' },
  { id: 's35', label: 'Super 35' },
  { id: 'aps-c', label: 'APS-C' },
  { id: 'mft', label: 'Micro Four Thirds' },
  { id: 'one-inch', label: '1-inch' },
  { id: 'medium', label: 'Medium format' },
];

/** True when the lens is made for a smaller sensor than the camera's: expect dark corners. */
export function vignettes(format: LensFormat | undefined, sensorWidth: number): boolean {
  return !!format && FORMAT_WIDTH[format] + 0.8 < sensorWidth;
}
