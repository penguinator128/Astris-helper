import type { LensSpec } from '@/types/project';

export interface LensDef extends LensSpec {
  id: string;
  weightKg: number;
  length: number; // mm
  diameter: number; // mm
}

const L = (id: string, manufacturer: string, model: string, mount: string, f: [number, number], ap: [number, number], minAperture: number, minFocus: number, filterThread: number, weightKg: number, length: number, diameter: number): LensDef => ({
  id, manufacturer, model, mount, focalMin: f[0], focalMax: f[1], maxAperture: ap[0], maxApertureTele: ap[1], minAperture, minFocus, filterThread, weightKg, length, diameter,
});

export const LENSES: LensDef[] = [
  L('rf-s-18-45', 'Canon', 'RF-S 18-45mm f/4.5-6.3 IS STM', 'RF', [18, 45], [4.5, 6.3], 22, 0.15, 49, 0.13, 44, 69),
  L('rf-50-18', 'Canon', 'RF 50mm f/1.8 STM', 'RF', [50, 50], [1.8, 1.8], 22, 0.3, 43, 0.16, 41, 69),
  L('rf-35-18', 'Canon', 'RF 35mm f/1.8 Macro IS STM', 'RF', [35, 35], [1.8, 1.8], 22, 0.17, 52, 0.31, 63, 74),
  L('rf-85-2', 'Canon', 'RF 85mm f/2 Macro IS STM', 'RF', [85, 85], [2, 2], 29, 0.35, 67, 0.5, 91, 78),
  L('rf-24-70-28', 'Canon', 'RF 24-70mm f/2.8L IS USM', 'RF', [24, 70], [2.8, 2.8], 22, 0.21, 82, 0.9, 126, 89),
  L('ef-50-18', 'Canon', 'EF 50mm f/1.8 STM', 'EF', [50, 50], [1.8, 1.8], 22, 0.35, 49, 0.16, 39, 69),
  L('ef-24-105-4', 'Canon', 'EF 24-105mm f/4L IS II USM', 'EF', [24, 105], [4, 4], 22, 0.45, 77, 0.8, 118, 84),
  L('sigma-18-35', 'Sigma', '18-35mm f/1.8 DC HSM Art (EF)', 'EF', [18, 35], [1.8, 1.8], 16, 0.28, 72, 0.81, 121, 78),
  L('fe-24-70-gm2', 'Sony', 'FE 24-70mm f/2.8 GM II', 'E', [24, 70], [2.8, 2.8], 22, 0.21, 82, 0.7, 120, 88),
  L('fe-50-18', 'Sony', 'FE 50mm f/1.8', 'E', [50, 50], [1.8, 1.8], 22, 0.45, 49, 0.19, 60, 68),
  L('fe-85-18', 'Sony', 'FE 85mm f/1.8', 'E', [85, 85], [1.8, 1.8], 22, 0.8, 67, 0.37, 82, 78),
  L('fe-16-35-pz', 'Sony', 'E PZ 16-35mm f/4 G', 'E', [16, 35], [4, 4], 22, 0.24, 72, 0.35, 88, 81),
  L('lumix-20-60', 'Panasonic', 'Lumix S 20-60mm f/3.5-5.6', 'L', [20, 60], [3.5, 5.6], 22, 0.15, 67, 0.35, 87, 78),
  L('lumix-50-18', 'Panasonic', 'Lumix S 50mm f/1.8', 'L', [50, 50], [1.8, 1.8], 22, 0.45, 67, 0.3, 82, 74),
  L('leica-12-60', 'Panasonic', 'Leica DG 12-60mm f/2.8-4', 'MFT', [12, 60], [2.8, 4], 22, 0.2, 62, 0.32, 86, 68),
  L('oly-25-18', 'OM System', 'M.Zuiko 25mm f/1.8', 'MFT', [25, 25], [1.8, 1.8], 22, 0.25, 46, 0.14, 42, 58),
  L('xf-18-55', 'Fujifilm', 'XF 18-55mm f/2.8-4 R LM OIS', 'X', [18, 55], [2.8, 4], 22, 0.3, 58, 0.31, 70, 65),
  L('xf-33-14', 'Fujifilm', 'XF 33mm f/1.4 R LM WR', 'X', [33, 33], [1.4, 1.4], 16, 0.3, 58, 0.36, 73, 67),
];

/** Adapters that genuinely exist (lens mount on the left fits a camera mount on the right). */
export const ADAPTERS: { id: string; name: string; lensMount: string; cameraMount: string; focalFactor: number; note: string }[] = [
  { id: 'ef-rf', name: 'Canon EF-EOS R mount adapter', lensMount: 'EF', cameraMount: 'RF', focalFactor: 1, note: 'Full autofocus and IS with Canon EF lenses.' },
  { id: 'ef-e', name: 'Sigma MC-11 (EF to E)', lensMount: 'EF', cameraMount: 'E', focalFactor: 1, note: 'Autofocus support varies by lens.' },
  { id: 'ef-l', name: 'Sigma MC-21 (EF to L)', lensMount: 'EF', cameraMount: 'L', focalFactor: 1, note: 'Autofocus support varies by lens.' },
  { id: 'ef-mft-sb', name: 'Metabones EF to MFT Speed Booster 0.71×', lensMount: 'EF', cameraMount: 'MFT', focalFactor: 0.71, note: 'Narrows focal length by 0.71× and gains about one stop.' },
];

export function lensDef(id: string): LensDef | undefined {
  return LENSES.find((l) => l.id === id);
}

/** Widest aperture available at a focal length (variable-aperture zooms close down as they zoom in). */
export function maxApertureAt(lens: LensSpec, focal: number): number {
  if (lens.focalMax <= lens.focalMin) return lens.maxAperture;
  const t = Math.min(1, Math.max(0, (focal - lens.focalMin) / (lens.focalMax - lens.focalMin)));
  return Math.round((lens.maxAperture + (lens.maxApertureTele - lens.maxAperture) * t) * 10) / 10;
}

export function lensesFor(mount: string): { native: LensDef[]; adapted: { lens: LensDef; adapter: (typeof ADAPTERS)[number] }[] } {
  const native = LENSES.filter((l) => l.mount === mount);
  const adapted = ADAPTERS.filter((a) => a.cameraMount === mount).flatMap((a) => LENSES.filter((l) => l.mount === a.lensMount).map((lens) => ({ lens, adapter: a })));
  return { native, adapted };
}
