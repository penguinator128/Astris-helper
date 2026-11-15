import { describe, expect, it } from 'vitest';
import { BODIES, body } from './bodies';
import { LENSES, lensesFor, maxApertureAt, lensDef } from './lenses';
import { defaultConfig, derive, normalise, shutterSeconds, warnings, whiteBalanceGains } from './settings';
import { encode, PROFILES } from './profiles';

describe('camera database', () => {
  it('every body has a valid sensor, codecs and profiles', () => {
    for (const b of BODIES) {
      expect(b.codecs.length).toBeGreaterThan(0);
      for (const p of b.profiles) expect(PROFILES.some((x) => x.id === p)).toBe(true);
      expect(b.isoRange[0]).toBeLessThan(b.isoRange[1]);
    }
  });
  it('only suggests lenses that fit, with real adapters', () => {
    const rf = lensesFor('RF');
    expect(rf.native.every((l) => l.mount === 'RF')).toBe(true);
    expect(rf.adapted.every((a) => a.lens.mount === 'EF')).toBe(true);
    expect(lensesFor('X').adapted).toHaveLength(0);
    expect(LENSES.find((l) => l.mount === 'E' && rf.native.includes(l))).toBeUndefined();
  });
  it('variable-aperture zooms close down as they zoom', () => {
    const kit = lensDef('rf-s-18-45')!;
    expect(maxApertureAt(kit, 18)).toBe(4.5);
    expect(maxApertureAt(kit, 45)).toBe(6.3);
  });
});

describe('camera settings', () => {
  it('180° at 25 fps is 1/50 s and the reference exposure is 0 stops', () => {
    const c = defaultConfig(body('sony-fx3'));
    expect(shutterSeconds(c)).toBeCloseTo(1 / 50, 6);
    const ref = { ...c, iso: 800, aperture: 2.8, fps: 24 };
    expect(derive(ref).cameraStops).toBeCloseTo(0, 6);
    expect(derive({ ...ref, aperture: 5.6 }).cameraStops).toBeCloseTo(-2, 6);
    expect(derive({ ...ref, iso: 3200 }).cameraStops).toBeCloseTo(2, 6);
  });
  it('clamps to the lens and body, and forces 10-bit for Log', () => {
    const kit = lensDef('rf-s-18-45')!;
    const c = normalise({ ...defaultConfig(body('canon-r50v'), kit), focalLength: 100, aperture: 1.4, iso: 50, profile: 'clog3', codec: 'H.265 (HEVC)', bitDepth: '8-bit' }, kit);
    expect(c.focalLength).toBe(45);
    expect(c.aperture).toBe(6.3);
    expect(c.iso).toBe(100);
    expect(c.bitDepth).toBe('10-bit');
  });
  it('limits frame rate to the resolution', () => {
    const c = normalise({ ...defaultConfig(body('canon-r50v')), resolution: '3840 × 2160 (4K UHD)', fps: 120 });
    expect(c.fps).toBeLessThanOrEqual(60);
  });
  it('warns about 50 Hz flicker and Log ISO', () => {
    const c = defaultConfig(body('sony-fx3'));
    const flick = warnings({ ...c, shutterMode: 'speed', shutterSpeed: 1 / 60 }, lensDef('fe-50-18'));
    expect(flick.some((w) => w.text.includes('flicker'))).toBe(true);
    const ok = warnings({ ...c, shutterMode: 'speed', shutterSpeed: 1 / 100 }, lensDef('fe-50-18'));
    expect(ok.some((w) => w.text.includes('flicker'))).toBe(false);
    expect(warnings({ ...c, profile: 'slog3', iso: 200 }, lensDef('fe-50-18')).some((w) => w.text.includes('S-Log3'))).toBe(true);
  });
  it('white balance gains neutralise matching light', () => {
    const [r, g, b] = whiteBalanceGains(3200, 0);
    expect(g).toBe(1);
    expect(r).toBeLessThan(1); // tungsten light is red-heavy, so red is pulled down
    expect(b).toBeGreaterThan(1);
  });
  it('log curves place middle grey where the makers do', () => {
    expect(encode('slog3', 0.18) * 1023).toBeCloseTo(420, 0);
    expect(encode('clog3', 0.18)).toBeGreaterThan(0.32);
    expect(encode('clog3', 0.18)).toBeLessThan(0.36);
    expect(encode('vlog', 0.18)).toBeCloseTo(0.423, 2);
    expect(encode('hlg', 0.18)).toBeGreaterThan(0.35);
    expect(encode('hlg', 0.18)).toBeLessThan(0.42);
  });
  it('motion blur grows with shutter time and speed', () => {
    const c = { ...defaultConfig(body('sony-fx3')), subjectSpeed: 1.4, focusDistance: 3, focalLength: 35 };
    const at180 = derive(c).subjectBlurPx;
    const at90 = derive({ ...c, shutterAngle: 90 }).subjectBlurPx;
    expect(at180).toBeCloseTo(at90 * 2, 6);
    expect(at180).toBeGreaterThan(10);
  });
});
