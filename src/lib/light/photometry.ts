import type { DiagramLight, DiagramObject, DiagramSubject, LightKind } from '@/types/project';
import { kelvinToMired, miredToKelvin } from '@/lib/calc/light';

/** Relative output of each source at 100% power, 1 m, on axis. Sun and window ignore distance. */
export const KIND_OUTPUT: Record<LightKind, number> = {
  key: 1,
  fill: 1,
  back: 1,
  hair: 1,
  kicker: 1,
  practical: 0.25,
  window: 2.5,
  sun: 10,
  bounce: 0,
  flag: 0,
  diffusion: 0,
  negfill: 0,
};

export const EMITTING: LightKind[] = ['key', 'fill', 'back', 'hair', 'kicker', 'practical', 'window', 'sun'];
export const MODIFIERS: LightKind[] = ['bounce', 'flag', 'diffusion', 'negfill'];

export interface Contribution {
  id: string;
  label: string;
  kind: LightKind;
  illuminance: number; // relative
  kelvin: number;
  gel: string;
  distance: number;
  onAxis: boolean;
  blockedBy?: string;
  diffusedBy?: string;
}

export interface Photometry {
  contributions: Contribution[];
  total: number;
  keyId: string | null;
  key: number;
  fill: number;
  ratio: number; // key : fill
  ratioStops: number;
  exposureStops: number; // relative to a 100% key at 2 m
  rawKey: number; // brightest source before face weighting (for the preview's auto exposure)
  mixKelvin: number | null;
  warmest: number | null;
  coolest: number | null;
}

const SUBJECT_EYE_HEIGHT = 1.5;

export function dirFromRotation(rotDeg: number): { x: number; y: number } {
  const r = (rotDeg * Math.PI) / 180;
  return { x: Math.sin(r), y: Math.cos(r) };
}

/** Does segment p1-p2 cross the bar (centre c, rotation rot, length len)? */
export function segmentCrossesBar(p1: { x: number; y: number }, p2: { x: number; y: number }, c: { x: number; y: number }, rotDeg: number, len: number): boolean {
  const d = dirFromRotation(rotDeg);
  // bar lies perpendicular to its facing direction
  const along = { x: d.y, y: -d.x };
  const a = { x: c.x - (along.x * len) / 2, y: c.y - (along.y * len) / 2 };
  const b = { x: c.x + (along.x * len) / 2, y: c.y + (along.y * len) / 2 };
  return segmentsIntersect(p1, p2, a, b);
}

function segmentsIntersect(p: { x: number; y: number }, p2: { x: number; y: number }, q: { x: number; y: number }, q2: { x: number; y: number }): boolean {
  const r = { x: p2.x - p.x, y: p2.y - p.y };
  const s = { x: q2.x - q.x, y: q2.y - q.y };
  const denom = r.x * s.y - r.y * s.x;
  if (Math.abs(denom) < 1e-9) return false;
  const qp = { x: q.x - p.x, y: q.y - p.y };
  const t = (qp.x * s.y - qp.y * s.x) / denom;
  const u = (qp.x * r.y - qp.y * r.x) / denom;
  return t > 0.02 && t < 0.98 && u >= 0 && u <= 1;
}

export function findSubject(objects: DiagramObject[]): DiagramSubject | null {
  return (objects.find((o) => o.type === 'subject') as DiagramSubject | undefined) ?? null;
}

/** Illuminance (relative) from a single light at a point, with a soft beam edge. */
export function illuminanceAt(light: DiagramLight, point: { x: number; y: number; z: number }, objects: DiagramObject[]): Contribution {
  const base: Contribution = { id: light.id, label: light.label, kind: light.kind, illuminance: 0, kelvin: light.kelvin, gel: light.gel, distance: 0, onAxis: true };
  if (!EMITTING.includes(light.kind)) return base;
  const dx = point.x - light.x;
  const dy = point.y - light.y;
  const dz = point.z - light.height;
  const dist = Math.max(0.2, Math.hypot(dx, dy, dz));
  base.distance = dist;
  const facing = dirFromRotation(light.rotation);
  const toPoint = { x: dx / dist, y: dy / dist };
  const cosAngle = facing.x * toPoint.x + facing.y * toPoint.y;
  const angle = (Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180) / Math.PI;
  const half = light.spread / 2;
  // Soft edge: full inside the beam, fading to 10% spill beyond 1.5x the half-angle.
  let beam = 1;
  if (light.kind === 'sun') beam = 1;
  else if (angle > half) beam = Math.max(0.1, 1 - (angle - half) / Math.max(1, half * 0.5));
  base.onAxis = angle <= half;
  const output = (light.power / 100) * KIND_OUTPUT[light.kind];
  let e = light.kind === 'sun' || light.kind === 'window' ? output * beam * (light.kind === 'window' ? Math.min(1, 1.5 / dist) : 1) : (output * beam) / (dist * dist);
  // Flags and diffusion between the light and the point
  for (const o of objects) {
    if (o.type !== 'light') continue;
    if (o.kind === 'flag' && segmentCrossesBar({ x: light.x, y: light.y }, { x: point.x, y: point.y }, o, o.rotation, o.size)) {
      e *= 0.08;
      base.blockedBy = o.label;
    } else if (o.kind === 'diffusion' && segmentCrossesBar({ x: light.x, y: light.y }, { x: point.x, y: point.y }, o, o.rotation, o.size)) {
      e *= 0.55;
      base.diffusedBy = o.label;
    }
  }
  base.illuminance = e;
  return base;
}

/** Evaluate the whole diagram at the subject. */
/** How much of a light reaches the face: full from the front, wrapping to the side, almost nothing from behind. */
export function faceFactor(subjectRotation: number, subject: { x: number; y: number }, light: { x: number; y: number }): number {
  const facing = dirFromRotation(subjectRotation);
  const dx = light.x - subject.x;
  const dy = light.y - subject.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return 1;
  const cos = (facing.x * dx + facing.y * dy) / d;
  return cos > 0 ? 0.3 + 0.7 * cos : Math.max(0.06, 0.3 + 0.6 * cos);
}

export function evaluate(objects: DiagramObject[]): Photometry {
  const subject = findSubject(objects);
  const point = subject ? { x: subject.x, y: subject.y, z: Math.min(subject.height, SUBJECT_EYE_HEIGHT) } : { x: 0, y: 0, z: SUBJECT_EYE_HEIGHT };
  const lights = objects.filter((o): o is DiagramLight => o.type === 'light');
  let rawKey = 0;
  const contributions: Contribution[] = lights
    .filter((l) => EMITTING.includes(l.kind))
    .map((l) => {
      const c = illuminanceAt(l, point, objects);
      rawKey = Math.max(rawKey, c.illuminance);
      if (subject) c.illuminance *= faceFactor(subject.rotation, subject, l);
      return c;
    });

  // Bounce cards redirect a fraction of what lands on them towards the subject.
  for (const card of lights.filter((l) => l.kind === 'bounce')) {
    const onCard = lights
      .filter((l) => EMITTING.includes(l.kind))
      .reduce((sum, l) => sum + illuminanceAt(l, { x: card.x, y: card.y, z: card.height }, objects).illuminance, 0);
    const d = Math.max(0.3, Math.hypot(point.x - card.x, point.y - card.y, point.z - card.height));
    const reflected = ((onCard * 0.6 * Math.min(1.5, card.size)) / (d * d)) * (subject ? faceFactor(subject.rotation, subject, card) : 1);
    if (reflected > 1e-4) {
      contributions.push({ id: card.id, label: card.label, kind: 'bounce', illuminance: reflected, kelvin: card.kelvin, gel: card.gel, distance: d, onAxis: true });
    }
  }

  const sorted = contributions.slice().sort((a, b) => b.illuminance - a.illuminance);
  const keyC = sorted[0];
  const key = keyC?.illuminance ?? 0;
  let fill = sorted.slice(1).reduce((s, c) => s + c.illuminance, 0);
  // Negative fill near the subject removes ambient spill
  const negCards = lights.filter((l) => l.kind === 'negfill' && Math.hypot(l.x - point.x, l.y - point.y) < 2.5).length;
  fill *= Math.max(0.3, 1 - 0.2 * negCards);
  const total = key + fill;
  const ratio = fill > 0 ? key / fill : Infinity;
  const weighted = contributions.filter((c) => c.illuminance > 0);
  const sumE = weighted.reduce((s, c) => s + c.illuminance, 0);
  const mixMired = sumE > 0 ? weighted.reduce((s, c) => s + kelvinToMired(c.kelvin) * c.illuminance, 0) / sumE : null;
  const kelvins = weighted.map((c) => c.kelvin);
  return {
    contributions: sorted,
    total,
    keyId: keyC?.id ?? null,
    key,
    fill,
    ratio,
    ratioStops: fill > 0 ? Math.log2(key / fill) : Infinity,
    exposureStops: total > 0 ? Math.log2(total / 0.25) : -Infinity,
    rawKey,
    mixKelvin: mixMired ? miredToKelvin(mixMired) : null,
    warmest: kelvins.length ? Math.min(...kelvins) : null,
    coolest: kelvins.length ? Math.max(...kelvins) : null,
  };
}

export function ratioLabel(ratio: number): string {
  if (!Number.isFinite(ratio)) return 'No fill';
  if (ratio < 1.2) return '1:1 flat';
  const r = Math.round(ratio * 10) / 10;
  return `${r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)}:1`;
}
