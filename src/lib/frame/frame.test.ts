import { describe, expect, it } from 'vitest';
import { classifyFigure, classifyShotSize } from './shotSize';
import { silhouette, SILHOUETTES } from './silhouettes';

describe('shot size classification', () => {
  it('full figure sizes', () => {
    expect(classifyFigure(0.3, 0.6)).toBe('WS');
    expect(classifyFigure(0.7, 0.15)).toBe('EWS');
    expect(classifyFigure(0, 1)).toBe('WS');
  });
  it('cropped figures by landmark', () => {
    expect(classifyFigure(0.1, 1.5)).toBe('MWS'); // mid-thigh
    expect(classifyFigure(0.15, 2.0)).toBe('MS'); // waist
    expect(classifyFigure(0.1, 3)).toBe('MCU'); // chest
    expect(classifyFigure(0.1, 5)).toBe('CU'); // head and shoulders
    expect(classifyFigure(-0.3, 8)).toBe('ECU'); // part of the face
  });
  it('figures entirely out of frame are not a subject', () => {
    expect(classifyFigure(1.2, 0.5)).toBeNull();
    expect(classifyFigure(-2, 1)).toBeNull();
  });
  it('uses the largest person and ignores props', () => {
    const els = [
      { id: 'a', kind: 'prop-box' as const, x: 0.5, y: 0.9, scale: 0.4, flip: false },
      { id: 'b', kind: 'standing' as const, x: 0.3, y: 0.95, scale: 0.5, flip: false },
      { id: 'c', kind: 'seated' as const, x: 0.7, y: 1.4, scale: 2, flip: false },
    ];
    expect(classifyShotSize(els)).toBe('MS');
    expect(classifyShotSize([els[0]])).toBeNull();
  });
});

describe('silhouettes', () => {
  it('every kind resolves and composite kinds reference real parts', () => {
    for (const s of SILHOUETTES) {
      expect(silhouette(s.id).id).toBe(s.id);
      for (const p of s.parts ?? []) expect(silhouette(p.ref).shapes.length).toBeGreaterThan(0);
    }
  });
});
