import type { DiagramObject, DiagramSubject, DiagramZone, FurnitureKind, Pose, ZoneKind } from '@/types/project';

export const POSES: { id: Pose; label: string; seat?: number }[] = [
  { id: 'standing', label: 'Standing' },
  { id: 'chair', label: 'Sitting on a chair', seat: 0.46 },
  { id: 'couch', label: 'Sitting on a couch', seat: 0.42 },
  { id: 'bench', label: 'Sitting on a bench', seat: 0.45 },
  { id: 'kneeling', label: 'Kneeling' },
  { id: 'lying', label: 'Lying down', seat: 0 },
  { id: 'walking', label: 'Walking' },
  { id: 'custom', label: 'Custom (seat height and lean)', seat: 0.6 },
];

export const FURNITURE: { id: FurnitureKind; label: string; w: number; d: number; seat: number; top: number; seats: number; pose: Pose }[] = [
  { id: 'couch', label: 'Couch', w: 2.1, d: 0.9, seat: 0.42, top: 0.85, seats: 3, pose: 'couch' },
  { id: 'armchair', label: 'Armchair', w: 0.85, d: 0.85, seat: 0.43, top: 0.9, seats: 1, pose: 'couch' },
  { id: 'chair', label: 'Chair', w: 0.48, d: 0.5, seat: 0.46, top: 0.88, seats: 1, pose: 'chair' },
  { id: 'bench', label: 'Bench', w: 1.6, d: 0.4, seat: 0.45, top: 0.45, seats: 3, pose: 'bench' },
  { id: 'stool', label: 'Stool', w: 0.38, d: 0.38, seat: 0.65, top: 0.65, seats: 1, pose: 'custom' },
  { id: 'table', label: 'Table', w: 1.4, d: 0.8, seat: 0, top: 0.75, seats: 0, pose: 'standing' },
  { id: 'bed', label: 'Bed', w: 1.53, d: 2.03, seat: 0.5, top: 0.5, seats: 2, pose: 'lying' },
];

export const isFurniture = (k: ZoneKind): k is FurnitureKind => FURNITURE.some((f) => f.id === k);
export const furnitureInfo = (k: ZoneKind) => FURNITURE.find((f) => f.id === k);

export function poseOf(s: DiagramSubject): Pose {
  return s.subjectKind === 'person' ? (s.pose ?? 'standing') : 'standing';
}

export function seatOf(s: DiagramSubject): number {
  const p = poseOf(s);
  return s.seatHeight ?? POSES.find((x) => x.id === p)?.seat ?? 0;
}

const seated = (p: Pose) => p === 'chair' || p === 'couch' || p === 'bench' || p === 'custom';

/**
 * Body heights for a pose, metres above the floor: the top of the head, the eyes, and the lowest visible point.
 * Proportions: eyes at 0.93 of standing height; seated, the eyes sit about 0.46 of standing height above the seat.
 */
export function bodyExtent(s: DiagramSubject): { top: number; eye: number; bottom: number; length: number } {
  const h = s.height;
  if (s.subjectKind !== 'person') return { top: h, eye: h * 0.9, bottom: 0, length: h };
  const p = poseOf(s);
  const seat = seatOf(s);
  const leanCos = Math.cos(((s.lean ?? (p === 'couch' ? 12 : 0)) * Math.PI) / 180);
  if (seated(p) && seat > 0) {
    const up = 0.52 * h * leanCos;
    return { top: seat + up, eye: seat + up - 0.07 * h, bottom: 0, length: h };
  }
  if (p === 'kneeling') return { top: 0.74 * h, eye: 0.67 * h, bottom: 0, length: 0.74 * h };
  if (p === 'lying') return { top: seat + 0.22, eye: seat + 0.14, bottom: seat, length: 0.22 };
  return { top: h, eye: 0.93 * h, bottom: 0, length: h };
}

/** Seat a number of people along a couch, bench or bed, evenly spaced and facing its front. */
export function seatPeople(z: DiagramZone, n: number, makeId: () => string, spacing?: number): DiagramSubject[] {
  const f = furnitureInfo(z.zoneKind);
  if (!f || n < 1) return [];
  const r = (z.rotation * Math.PI) / 180;
  const fwd = { x: Math.sin(r), y: Math.cos(r) };
  const side = { x: Math.cos(r), y: -Math.sin(r) };
  const gap = spacing ?? Math.min(0.7, (z.w - 0.1) / n);
  const front = f.pose === 'lying' ? 0 : z.h * 0.08;
  return Array.from({ length: n }, (_, i) => {
    const off = (i - (n - 1) / 2) * gap;
    return {
      id: makeId(),
      type: 'subject' as const,
      subjectKind: 'person' as const,
      height: 1.7,
      pose: f.pose,
      seatHeight: f.seat,
      x: +(z.x + side.x * off + fwd.x * front).toFixed(3),
      y: +(z.y + side.y * off + fwd.y * front).toFixed(3),
      rotation: z.rotation,
      locked: false,
      label: `Person ${i + 1}`,
    };
  });
}

export function subjects(objects: DiagramObject[]): DiagramSubject[] {
  return objects.filter((o): o is DiagramSubject => o.type === 'subject');
}
