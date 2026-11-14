import { describe, expect, it } from 'vitest';
import { dirFromRotation, evaluate, illuminanceAt, ratioLabel, segmentCrossesBar } from './photometry';
import type { DiagramLight, DiagramObject } from '@/types/project';

const subject: DiagramObject = { id: 's', type: 'subject', subjectKind: 'person', height: 1.7, x: 0, y: 0, rotation: 180, locked: false, label: 'Subject' };
function light(partial: Partial<DiagramLight> & { id: string; x: number; y: number }): DiagramLight {
  return { type: 'light', kind: 'key', power: 100, kelvin: 5600, size: 0.6, height: 1.5, tilt: 0, gel: '', spread: 60, rotation: 0, locked: false, label: partial.id, ...partial };
}
/** Rotation that points a light at the origin. */
function aim(x: number, y: number): number {
  return (Math.atan2(-x, -y) * 180) / Math.PI;
}

describe('photometry', () => {
  it('rotation 0 faces +y and 90 faces +x', () => {
    expect(dirFromRotation(0).y).toBeCloseTo(1, 6);
    expect(dirFromRotation(90).x).toBeCloseTo(1, 6);
  });
  it('inverse square: a light at 2 m gives a quarter of one at 1 m (same height as the point)', () => {
    const a = illuminanceAt(light({ id: 'a', x: 0, y: -1, height: 1.5, rotation: 0 }), { x: 0, y: 0, z: 1.5 }, []);
    const b = illuminanceAt(light({ id: 'b', x: 0, y: -2, height: 1.5, rotation: 0 }), { x: 0, y: 0, z: 1.5 }, []);
    expect(a.illuminance / b.illuminance).toBeCloseTo(4, 6);
  });
  it('a light pointing away spills only a little', () => {
    const on = illuminanceAt(light({ id: 'a', x: 0, y: -2, rotation: 0 }), { x: 0, y: 0, z: 1.5 }, []);
    const off = illuminanceAt(light({ id: 'b', x: 0, y: -2, rotation: 180 }), { x: 0, y: 0, z: 1.5 }, []);
    expect(off.illuminance / on.illuminance).toBeCloseTo(0.1, 2);
    expect(off.onAxis).toBe(false);
  });
  it('a flag between light and subject cuts the light', () => {
    const key = light({ id: 'k', x: 0, y: -3, rotation: 0 });
    const flag = light({ id: 'f', kind: 'flag', x: 0, y: -1.5, rotation: 0, size: 1.2 });
    const open = illuminanceAt(key, { x: 0, y: 0, z: 1.5 }, [key]);
    const flagged = illuminanceAt(key, { x: 0, y: 0, z: 1.5 }, [key, flag]);
    expect(flagged.illuminance).toBeLessThan(open.illuminance * 0.1);
    expect(flagged.blockedBy).toBe('f');
    expect(segmentCrossesBar({ x: 0, y: -3 }, { x: 0, y: 0 }, { x: 0, y: -1.5 }, 0, 1.2)).toBe(true);
    expect(segmentCrossesBar({ x: 0, y: -3 }, { x: 0, y: 0 }, { x: 2, y: -1.5 }, 0, 1.2)).toBe(false);
  });
  it('three-point lighting reports a sensible key to fill ratio and colour mix', () => {
    const objects: DiagramObject[] = [
      subject,
      light({ id: 'key', kind: 'key', x: -1.8, y: -1.6, rotation: aim(-1.8, -1.6), power: 100, kelvin: 5600 }),
      light({ id: 'fill', kind: 'fill', x: 1.8, y: -1.6, rotation: aim(1.8, -1.6), power: 25, kelvin: 3200 }),
    ];
    const p = evaluate(objects);
    expect(p.keyId).toBe('key');
    expect(p.ratio).toBeCloseTo(4, 1);
    expect(p.ratioStops).toBeCloseTo(2, 1);
    expect(p.mixKelvin!).toBeGreaterThan(3200);
    expect(p.mixKelvin!).toBeLessThan(5600);
    expect(ratioLabel(p.ratio)).toBe('4:1');
  });
  it('no fill gives an infinite ratio and a bounce card adds some', () => {
    const key = light({ id: 'key', x: -2, y: -2, rotation: aim(-2, -2) });
    const none = evaluate([subject, key]);
    expect(none.ratio).toBe(Infinity);
    expect(ratioLabel(none.ratio)).toBe('No fill');
    const bounce = light({ id: 'b', kind: 'bounce', x: 1.2, y: -1.2, rotation: aim(1.2, -1.2), size: 1 });
    const withBounce = evaluate([subject, key, bounce]);
    expect(withBounce.fill).toBeGreaterThan(0);
    expect(Number.isFinite(withBounce.ratio)).toBe(true);
  });
  it('a back light behind the subject barely counts towards the face', () => {
    const key = light({ id: 'key', x: -1.8, y: -1.6, rotation: aim(-1.8, -1.6) });
    const back = light({ id: 'back', kind: 'back', x: 1.3, y: 1.9, rotation: aim(1.3, 1.9), power: 60 });
    const p = evaluate([subject, key, back]);
    expect(p.keyId).toBe('key');
    expect(p.ratio).toBeGreaterThan(5);
  });
  it('exposure reference: a 100% key at 2 m reads 0 stops', () => {
    const p = evaluate([subject, light({ id: 'k', x: 0, y: -2, height: 1.5, rotation: 0 })]);
    expect(p.exposureStops).toBeCloseTo(0, 5);
  });
});
