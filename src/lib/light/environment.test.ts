import { describe, expect, it } from 'vitest';
import { evaluate } from './photometry';
import { presetEnv, effectiveLight, roomBounceRel } from './environment';
import { defaultLight } from '@/modules/light/presets';
import type { DiagramObject } from '@/types/project';

const scene = (): DiagramObject[] => [
  { id: 's', type: 'subject', subjectKind: 'person', height: 1.7, x: 0, y: 0, rotation: 180, locked: false, label: 'S' },
  defaultLight('key', -1.4, -1.4, { id: 'k', rotation: 45 }),
];

describe('environment', () => {
  it('leaves plans without an environment unchanged', () => {
    expect(evaluate(scene()).total).toBeCloseTo(evaluate(scene(), undefined).total, 9);
  });
  it('a white room adds bounce fill and softens the ratio; a dark studio adds almost none', () => {
    const white = evaluate(scene(), presetEnv('white-studio'));
    const dark = evaluate(scene(), presetEnv('dark-studio'));
    expect(white.fill).toBeGreaterThan(dark.fill * 3);
    expect(white.ratio).toBeLessThan(10);
    expect(roomBounceRel(presetEnv('dark-studio'), [], () => true)).toBe(0);
  });
  it('overcast daylight dwarfs a small lamp', () => {
    const o = evaluate(scene(), presetEnv('overcast'));
    expect(o.contributions[0].id).toBe('env-ambient');
  });
  it('diffusion costs output and grows the source', () => {
    const l = defaultLight('key', 0, -2, { diffusion: 'heavy' });
    const e = effectiveLight(l);
    expect(e.output).toBeLessThan(0.5);
    expect(e.size).toBeCloseTo(l.size * 3);
  });
});
