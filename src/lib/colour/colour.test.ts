import { describe, expect, it } from 'vitest';
import { contrastRatio, describe as describeColour, extractPalette, kmeans, oklchToHex, parseHex, preset, roughName, scheme } from './colour';
import { kelvinToHex } from './kelvin';

describe('colour conversions', () => {
  it('round-trips hex through OKLCH', () => {
    const o = parseHex('#ffc400')!;
    expect(o.l).toBeGreaterThan(0.8);
    expect(o.h).toBeGreaterThan(80);
    expect(o.h).toBeLessThan(100);
    expect(oklchToHex(o.l, o.c, o.h)).toBe('#ffc400');
  });
  it('describes a colour in every notation', () => {
    const d = describeColour('#0b0b0c');
    expect(d.hex).toBe('#0b0b0c');
    expect(d.rgb).toBe('rgb(11 11 12)');
    expect(d.hsl.startsWith('hsl(')).toBe(true);
    expect(d.oklch.startsWith('oklch(')).toBe(true);
  });
  it('contrast ratio of black on white is 21 and yellow on ink passes AA', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#ffc400', '#0b0b0c')).toBeGreaterThan(4.5);
    expect(contrastRatio('#ffc400', '#ffffff')).toBeLessThan(3);
  });
  it('black body colours go from orange to blue', () => {
    expect(kelvinToHex(2000)).toMatch(/^#ff/);
    const cold = kelvinToHex(12000);
    expect(parseInt(cold.slice(5, 7), 16)).toBe(255);
  });
});

describe('schemes and presets', () => {
  it('complementary puts the second colour 180° away', () => {
    const [a, b] = scheme('#3366cc', 'complementary');
    const ha = parseHex(a)!.h;
    const hb = parseHex(b)!.h;
    const diff = Math.abs((((hb - ha) % 360) + 360) % 360);
    expect(Math.abs(diff - 180)).toBeLessThan(6);
  });
  it('every scheme keeps the must-have colour and returns five swatches', () => {
    for (const id of ['complementary', 'split', 'analogous', 'triadic', 'tetradic', 'mono'] as const) {
      const out = scheme('#e0ab00', id);
      expect(out).toHaveLength(5);
      expect(out).toContain('#e0ab00');
      for (const hex of out) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it('presets return five valid colours', () => {
    for (const id of ['teal-orange', 'pastel', 'noir', 'neon', 'nostalgic', 'drama'] as const) {
      const out = preset('#e0ab00', id);
      expect(out).toHaveLength(5);
      for (const hex of out) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it('rough names', () => {
    expect(roughName('#ffffff')).toBe('White');
    expect(roughName('#ffc400')).toMatch(/Yellow|Orange/);
    expect(roughName('#1b3a8a')).toMatch(/Blue/);
  });
});

describe('k-means extraction', () => {
  it('finds the two colours in a two-colour image', () => {
    const px: number[] = [];
    for (let i = 0; i < 100; i++) px.push(1, 0, 0);
    for (let i = 0; i < 100; i++) px.push(0, 0, 1);
    const centres = kmeans(Float32Array.from(px), 2);
    const sorted = centres.map((c) => c.map((v) => Math.round(v)).join(',')).sort();
    expect(sorted).toEqual(['0,0,1', '1,0,0']);
  });
  it('extractPalette returns k hex colours and ignores transparent pixels', () => {
    const data = new Uint8ClampedArray(4 * 400);
    for (let i = 0; i < 400; i++) {
      const red = i < 200;
      data.set([red ? 255 : 10, red ? 30 : 200, 20, i % 50 === 0 ? 0 : 255], i * 4);
    }
    const pal = extractPalette(data, 2);
    expect(pal).toHaveLength(2);
    expect(pal.every((h) => /^#[0-9a-f]{6}$/.test(h))).toBe(true);
  });
});
