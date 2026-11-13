import type { SilhouetteKind } from '@/types/project';

export type Shape = { kind: 'circle'; cx: number; cy: number; r: number } | { kind: 'path'; d: string } | { kind: 'rect'; x: number; y: number; w: number; h: number };

export interface SilhouetteDef {
  id: SilhouetteKind;
  label: string;
  group: 'people' | 'props';
  box: { w: number; h: number }; // native units; height maps to element.scale × frame height
  person: boolean;
  /** Fraction of the box height where the head top sits (for shot-size maths). */
  headTop: number;
  shapes: Shape[];
  /** Compose from other silhouettes (used for two-shot and group). */
  parts?: { ref: SilhouetteKind; dx: number; dy: number; s: number }[];
}

const STANDING: Shape[] = [
  { kind: 'circle', cx: 50, cy: 26, r: 22 },
  {
    kind: 'path',
    d: 'M40 50 L60 50 L64 60 L76 66 L84 150 L74 153 L68 98 L66 176 L62 292 L52 292 L51 190 L49 190 L48 292 L38 292 L34 176 L32 98 L26 153 L16 150 L24 66 L36 60 Z',
  },
];

const SEATED: Shape[] = [
  { kind: 'circle', cx: 44, cy: 24, r: 20 },
  {
    kind: 'path',
    d: 'M34 46 L54 46 L60 56 L70 62 L74 128 L96 128 L98 136 L92 136 L92 198 L82 198 L82 136 L62 136 L60 198 L50 198 L50 142 L30 142 L30 198 L20 198 L20 134 L16 128 L20 62 L30 56 Z',
  },
];

export const SILHOUETTES: SilhouetteDef[] = [
  { id: 'standing', label: 'Standing', group: 'people', box: { w: 100, h: 300 }, person: true, headTop: 4 / 300, shapes: STANDING },
  { id: 'seated', label: 'Seated', group: 'people', box: { w: 100, h: 200 }, person: true, headTop: 4 / 200, shapes: SEATED },
  {
    id: 'two-shot',
    label: 'Two-shot',
    group: 'people',
    box: { w: 230, h: 300 },
    person: true,
    headTop: 4 / 300,
    shapes: [],
    parts: [
      { ref: 'standing', dx: 0, dy: 0, s: 1 },
      { ref: 'standing', dx: 130, dy: 12, s: 0.96 },
    ],
  },
  {
    id: 'group',
    label: 'Group',
    group: 'people',
    box: { w: 440, h: 300 },
    person: true,
    headTop: 4 / 300,
    shapes: [],
    parts: [
      { ref: 'standing', dx: 0, dy: 20, s: 0.93 },
      { ref: 'standing', dx: 115, dy: 0, s: 1 },
      { ref: 'standing', dx: 225, dy: 30, s: 0.9 },
      { ref: 'standing', dx: 340, dy: 6, s: 0.98 },
    ],
  },
  {
    id: 'prop-box',
    label: 'Box / table',
    group: 'props',
    box: { w: 160, h: 100 },
    person: false,
    headTop: 0,
    shapes: [{ kind: 'path', d: 'M0 30 L40 0 L160 0 L160 70 L120 100 L0 100 Z M0 30 L120 30 L160 0 M120 30 L120 100' }],
  },
  { id: 'prop-round', label: 'Round', group: 'props', box: { w: 120, h: 120 }, person: false, headTop: 0, shapes: [{ kind: 'circle', cx: 60, cy: 60, r: 60 }] },
  {
    id: 'prop-tall',
    label: 'Post / lamp',
    group: 'props',
    box: { w: 40, h: 300 },
    person: false,
    headTop: 0,
    shapes: [
      { kind: 'rect', x: 16, y: 20, w: 8, h: 280 },
      { kind: 'path', d: 'M4 0 L36 0 L30 24 L10 24 Z' },
    ],
  },
];

export function silhouette(id: SilhouetteKind): SilhouetteDef {
  return SILHOUETTES.find((s) => s.id === id) ?? SILHOUETTES[0];
}
