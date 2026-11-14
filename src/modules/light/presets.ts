import { uid } from '@/lib/id';
import type { DiagramLight, DiagramObject, LightKind, LightingDiagram } from '@/types/project';
import { LIGHT_KINDS } from '@/types/project';

const aim = (x: number, y: number, tx = 0, ty = 0) => Math.round((Math.atan2(tx - x, ty - y) * 180) / Math.PI);

export function defaultLight(kind: LightKind, x: number, y: number, extra: Partial<DiagramLight> = {}): DiagramLight {
  const base: Record<LightKind, Partial<DiagramLight>> = {
    key: { power: 100, kelvin: 5600, size: 0.9, height: 2, tilt: -20, spread: 60 },
    fill: { power: 35, kelvin: 5600, size: 1.2, height: 1.6, tilt: -10, spread: 80 },
    back: { power: 60, kelvin: 5600, size: 0.3, height: 2.3, tilt: -35, spread: 40 },
    hair: { power: 50, kelvin: 5600, size: 0.2, height: 2.6, tilt: -50, spread: 30 },
    kicker: { power: 60, kelvin: 5600, size: 0.3, height: 1.7, tilt: -10, spread: 35 },
    practical: { power: 60, kelvin: 2700, size: 0.2, height: 1.1, tilt: 0, spread: 180 },
    window: { power: 100, kelvin: 6500, size: 1.5, height: 1.6, tilt: -10, spread: 120 },
    sun: { power: 100, kelvin: 5200, size: 0.1, height: 10, tilt: -45, spread: 180 },
    bounce: { power: 0, kelvin: 5600, size: 1, height: 1.2, tilt: 0, spread: 120 },
    flag: { power: 0, kelvin: 5600, size: 0.9, height: 1.5, tilt: 0, spread: 0 },
    diffusion: { power: 0, kelvin: 5600, size: 1.2, height: 1.6, tilt: 0, spread: 0 },
    negfill: { power: 0, kelvin: 5600, size: 1.2, height: 1.5, tilt: 0, spread: 0 },
  };
  const label = LIGHT_KINDS.find((k) => k.id === kind)?.label ?? kind;
  return {
    id: uid(),
    type: 'light',
    kind,
    x,
    y,
    rotation: aim(x, y),
    locked: false,
    label,
    gel: '',
    power: 100,
    kelvin: 5600,
    size: 0.6,
    height: 1.8,
    tilt: -15,
    spread: 60,
    ...base[kind],
    ...extra,
  };
}

export function subjectObject(rotation = 180): DiagramObject {
  return { id: uid(), type: 'subject', subjectKind: 'person', height: 1.7, x: 0, y: 0, rotation, locked: false, label: 'Subject' };
}

export function cameraObject(x = 0, y = -3.5): DiagramObject {
  return { id: uid(), type: 'camera', x, y, rotation: aim(x, y), locked: false, label: 'Camera' };
}

export interface PresetDef {
  id: string;
  name: string;
  note: string;
  build: () => DiagramObject[];
}

export const PRESETS: PresetDef[] = [
  {
    id: 'three-point',
    name: 'Three-point',
    note: 'Key, softer fill opposite, back light for separation.',
    build: () => [subjectObject(), cameraObject(), defaultLight('key', -1.8, -1.6), defaultLight('fill', 1.9, -1.5), defaultLight('back', 1.3, 1.9)],
  },
  {
    id: 'rembrandt',
    name: 'Rembrandt',
    note: 'Key at 45° and high for the triangle on the shadow cheek; low fill.',
    build: () => [subjectObject(), cameraObject(), defaultLight('key', -1.5, -1.5, { height: 2.3, tilt: -38 }), defaultLight('fill', 2.3, -1.4, { power: 18, size: 1.5 })],
  },
  {
    id: 'butterfly',
    name: 'Butterfly',
    note: 'Key high and centred over the lens; bounce from below softens the chin shadow.',
    build: () => [subjectObject(), cameraObject(), defaultLight('key', 0, -2.2, { height: 2.5, tilt: -42, size: 1.1 }), defaultLight('bounce', 0, -1.1, { height: 0.6, tilt: 30 })],
  },
  {
    id: 'split',
    name: 'Split',
    note: 'Key at 90° lights half the face; negative fill keeps the other half dark.',
    build: () => [subjectObject(), cameraObject(), defaultLight('key', -2.2, 0, { height: 1.8, tilt: -12, size: 0.6 }), defaultLight('negfill', 1.3, 0)],
  },
  {
    id: 'loop',
    name: 'Loop',
    note: 'Key slightly above and to the side so the nose shadow loops down the cheek.',
    build: () => [subjectObject(), cameraObject(), defaultLight('key', -1.3, -1.9, { height: 2, tilt: -22 }), defaultLight('fill', 1.7, -1.7, { power: 35 })],
  },
  {
    id: 'broad',
    name: 'Broad',
    note: 'Face turned away from the key, so the near, wider side is lit.',
    build: () => [subjectObject(205), cameraObject(), defaultLight('key', 1.9, -1.5, { height: 2 }), defaultLight('fill', -2, -1.4, { power: 25 })],
  },
  {
    id: 'short',
    name: 'Short',
    note: 'Face turned towards the key, so the far, narrower side is lit. Slimming and moody.',
    build: () => [subjectObject(155), cameraObject(), defaultLight('key', 1.9, -1.5, { height: 2 }), defaultLight('fill', -2, -1.4, { power: 20 })],
  },
  {
    id: 'noir',
    name: 'Noir',
    note: 'One hard, high key with a tight beam, no fill, kicker from behind.',
    build: () => [
      subjectObject(),
      cameraObject(),
      defaultLight('key', -2.1, -1.1, { height: 2.6, tilt: -40, size: 0.15, spread: 28, kelvin: 4300 }),
      defaultLight('kicker', 1.9, 1.6, { power: 70, size: 0.15, spread: 25 }),
      defaultLight('negfill', 1.4, -0.6),
      defaultLight('flag', -1.2, -0.9, { size: 0.6, height: 1.2 }),
    ],
  },
  {
    id: 'golden-window',
    name: 'Golden-hour window',
    note: 'Warm low window as the key, white bounce opposite, practical in the background.',
    build: () => [
      subjectObject(150),
      cameraObject(0.8, -3.2),
      defaultLight('window', -2.6, 0.8, { kelvin: 3400, height: 1.5, tilt: -8, size: 1.8, power: 90 }),
      defaultLight('bounce', 1.6, -0.6, { size: 1.2, height: 1.3 }),
      defaultLight('practical', 2.2, 2.4, { kelvin: 2700, power: 50 }),
    ],
  },
  {
    id: 'neon-night',
    name: 'Neon night',
    note: 'Magenta practical as the key, cyan kicker behind, low cool fill.',
    build: () => [
      subjectObject(),
      cameraObject(),
      defaultLight('practical', -1.3, -1.1, { gel: '#ff2d9b', power: 90, kelvin: 3200, height: 1.3, label: 'Neon sign' }),
      defaultLight('kicker', 1.6, 1.6, { gel: '#19d9ff', kelvin: 6500, power: 80, size: 0.4 }),
      defaultLight('fill', 1.8, -2, { power: 15, kelvin: 7000, size: 1.6 }),
    ],
  },
];

export function newDiagram(name: string, presetId = 'three-point'): LightingDiagram {
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  return { id: uid(), name, objects: preset.build(), gridSize: 1, showSunPath: false, notes: '', updatedAt: Date.now() };
}

export function blankDiagram(name: string): LightingDiagram {
  return { id: uid(), name, objects: [subjectObject(), cameraObject()], gridSize: 1, showSunPath: false, notes: '', updatedAt: Date.now() };
}
