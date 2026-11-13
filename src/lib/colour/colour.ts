import { converter, formatHex, parse, clampChroma, wcagContrast, type Rgb } from 'culori';

const toOklch = converter('oklch');
const toRgb = converter('rgb');
const toHsl = converter('hsl');

export interface ColourInfo {
  hex: string;
  rgb: string;
  hsl: string;
  oklch: string;
  l: number; // 0..1
  c: number; // 0..0.4
  h: number; // 0..360
}

export interface OklchColour {
  l: number;
  c: number;
  h: number;
}

export function parseHex(hex: string): OklchColour | null {
  const p = parse(hex);
  if (!p) return null;
  const o = toOklch(p);
  if (!o) return null;
  return { l: o.l, c: o.c, h: o.h ?? 0 };
}

export function oklchToHex(l: number, c: number, h: number): string {
  const clamped = clampChroma({ mode: 'oklch', l: Math.max(0, Math.min(1, l)), c: Math.max(0, c), h: ((h % 360) + 360) % 360 }, 'oklch');
  return formatHex(clamped);
}

export function describe(hex: string): ColourInfo {
  const o = parseHex(hex) ?? { l: 0, c: 0, h: 0 };
  const rgb = toRgb(hex) as Rgb;
  const hsl = toHsl(hex);
  const r = Math.round((rgb?.r ?? 0) * 255);
  const g = Math.round((rgb?.g ?? 0) * 255);
  const b = Math.round((rgb?.b ?? 0) * 255);
  return {
    hex: formatHex(hex) ?? hex,
    rgb: `rgb(${r} ${g} ${b})`,
    hsl: `hsl(${Math.round(hsl?.h ?? 0)} ${Math.round((hsl?.s ?? 0) * 100)}% ${Math.round((hsl?.l ?? 0) * 100)}%)`,
    oklch: `oklch(${(o.l * 100).toFixed(0)}% ${o.c.toFixed(3)} ${Math.round(o.h)})`,
    l: o.l,
    c: o.c,
    h: o.h,
  };
}

export function contrastRatio(a: string, b: string): number {
  return wcagContrast(a, b);
}

export type SchemeId = 'complementary' | 'split' | 'analogous' | 'triadic' | 'tetradic' | 'mono';
export type PresetId = 'teal-orange' | 'pastel' | 'noir' | 'neon' | 'nostalgic' | 'drama';

export const SCHEMES: { id: SchemeId; name: string }[] = [
  { id: 'complementary', name: 'Complementary' },
  { id: 'split', name: 'Split-complementary' },
  { id: 'analogous', name: 'Analogous' },
  { id: 'triadic', name: 'Triadic' },
  { id: 'tetradic', name: 'Tetradic' },
  { id: 'mono', name: 'Monochrome' },
];

export const PRESETS: { id: PresetId; name: string; note: string }[] = [
  { id: 'teal-orange', name: 'Teal and orange', note: 'Blockbuster skin-against-sky separation.' },
  { id: 'pastel', name: 'Pastel', note: 'Lifted, low-chroma, soft daylight.' },
  { id: 'noir', name: 'Noir', note: 'Near-monochrome with one cold accent.' },
  { id: 'neon', name: 'Neon', note: 'Saturated magenta and cyan against black.' },
  { id: 'nostalgic', name: 'Warm nostalgic', note: 'Amber, cream and faded green.' },
  { id: 'drama', name: 'Desaturated drama', note: 'Muted, dark, one warm anchor.' },
];

/** Rotate hue, move lightness proportionally towards white (dl > 0) or black (dl < 0), scale chroma. */
function shift(base: OklchColour, dh: number, dl = 0, cMul = 1): string {
  const l = dl >= 0 ? base.l + (0.97 - base.l) * dl * 2 : base.l + (base.l - 0.08) * dl * 2;
  return oklchToHex(l, base.c * cMul, base.h + dh);
}

/** Palette around a must-have colour, in OKLCH so lightness stays perceptually even. */
export function scheme(hex: string, id: SchemeId): string[] {
  const b = parseHex(hex);
  if (!b) return [hex];
  const keep = formatHex(hex) ?? hex;
  switch (id) {
    case 'complementary':
      return [keep, shift(b, 180), shift(b, 0, 0.18, 0.5), shift(b, 180, -0.18, 0.7), shift(b, 0, -0.3, 0.4)];
    case 'split':
      return [keep, shift(b, 150), shift(b, 210), shift(b, 0, 0.2, 0.4), shift(b, 180, -0.25, 0.3)];
    case 'analogous':
      return [shift(b, -40, 0.05, 0.9), shift(b, -20), keep, shift(b, 20), shift(b, 40, -0.05, 0.9)];
    case 'triadic':
      return [keep, shift(b, 120), shift(b, 240), shift(b, 0, 0.22, 0.35), shift(b, 120, -0.22, 0.5)];
    case 'tetradic':
      return [keep, shift(b, 90), shift(b, 180), shift(b, 270), shift(b, 0, -0.3, 0.25)];
    case 'mono':
      return [shift(b, 0, 0.3, 0.35), shift(b, 0, 0.15, 0.7), keep, shift(b, 0, -0.15, 0.9), shift(b, 0, -0.3, 0.6)];
  }
}

export function preset(hex: string, id: PresetId): string[] {
  const b = parseHex(hex) ?? { l: 0.6, c: 0.12, h: 60 };
  const h = b.h;
  switch (id) {
    case 'teal-orange':
      return [oklchToHex(0.7, 0.16, 55), oklchToHex(0.55, 0.12, 200), oklchToHex(0.82, 0.08, 70), oklchToHex(0.3, 0.06, 215), oklchToHex(0.18, 0.02, 230)];
    case 'pastel':
      return [oklchToHex(0.88, 0.06, h), oklchToHex(0.86, 0.06, h + 60), oklchToHex(0.85, 0.05, h + 150), oklchToHex(0.87, 0.05, h + 220), oklchToHex(0.95, 0.01, h)];
    case 'noir':
      return [oklchToHex(0.12, 0.005, h), oklchToHex(0.3, 0.01, h), oklchToHex(0.55, 0.01, h), oklchToHex(0.9, 0.005, h), oklchToHex(0.62, 0.1, 230)];
    case 'neon':
      return [oklchToHex(0.1, 0.01, 280), oklchToHex(0.68, 0.3, 335), oklchToHex(0.85, 0.16, 195), oklchToHex(0.6, 0.25, 290), oklchToHex(0.93, 0.18, 110)];
    case 'nostalgic':
      return [oklchToHex(0.75, 0.13, 70), oklchToHex(0.92, 0.04, 85), oklchToHex(0.55, 0.06, 140), oklchToHex(0.45, 0.08, 40), oklchToHex(0.3, 0.03, 60)];
    case 'drama':
      return [oklchToHex(0.22, 0.01, h), oklchToHex(0.38, 0.03, h + 200), oklchToHex(0.55, 0.04, h + 180), oklchToHex(0.72, 0.1, 50), oklchToHex(0.85, 0.02, 80)];
  }
}

/** Name-ish label for a colour based on OKLCH hue and lightness. */
export function roughName(hex: string): string {
  const o = parseHex(hex);
  if (!o) return 'Colour';
  if (o.c < 0.02) return o.l > 0.9 ? 'White' : o.l < 0.15 ? 'Black' : 'Grey';
  const h = o.h;
  const hue = h < 25 ? 'Pink' : h < 55 ? 'Red' : h < 80 ? 'Orange' : h < 105 ? 'Yellow' : h < 160 ? 'Green' : h < 200 ? 'Teal' : h < 250 ? 'Cyan' : h < 290 ? 'Blue' : h < 330 ? 'Violet' : 'Magenta';
  const tone = o.l > 0.8 ? 'Light ' : o.l < 0.35 ? 'Deep ' : o.c < 0.07 ? 'Muted ' : '';
  return `${tone}${hue}`;
}

/* ---------- k-means palette extraction ---------- */

export function kmeans(pixels: Float32Array, k: number, iterations = 12): number[][] {
  const n = pixels.length / 3;
  if (n === 0) return [];
  // Initialise with evenly spaced samples sorted by lightness-ish for stability.
  const centres: number[][] = [];
  for (let i = 0; i < k; i++) {
    const idx = Math.floor(((i + 0.5) / k) * n);
    centres.push([pixels[idx * 3], pixels[idx * 3 + 1], pixels[idx * 3 + 2]]);
  }
  const assign = new Int32Array(n);
  for (let it = 0; it < iterations; it++) {
    for (let p = 0; p < n; p++) {
      const r = pixels[p * 3];
      const g = pixels[p * 3 + 1];
      const b = pixels[p * 3 + 2];
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < k; c++) {
        const d = (r - centres[c][0]) ** 2 + (g - centres[c][1]) ** 2 + (b - centres[c][2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[p] = best;
    }
    const sums = centres.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < n; p++) {
      const s = sums[assign[p]];
      s[0] += pixels[p * 3];
      s[1] += pixels[p * 3 + 1];
      s[2] += pixels[p * 3 + 2];
      s[3]++;
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) centres[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]];
    }
  }
  // Order by cluster size, largest first
  const counts = new Array(k).fill(0);
  for (let p = 0; p < n; p++) counts[assign[p]]++;
  return centres.map((c, i) => ({ c, n: counts[i] })).sort((a, b) => b.n - a.n).map((x) => x.c);
}

/** Extract k dominant colours from RGBA image data (values 0..255). Runs entirely in the browser. */
export function extractPalette(data: Uint8ClampedArray, k = 6): string[] {
  const n = data.length / 4;
  const step = Math.max(1, Math.floor(n / 6000));
  const samples: number[] = [];
  for (let i = 0; i < n; i += step) {
    if (data[i * 4 + 3] < 128) continue;
    samples.push(data[i * 4] / 255, data[i * 4 + 1] / 255, data[i * 4 + 2] / 255);
  }
  const centres = kmeans(Float32Array.from(samples), k);
  return centres.map(([r, g, b]) => formatHex({ mode: 'rgb', r, g, b }) ?? '#000000');
}
