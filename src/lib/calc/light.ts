/* Light power, inverse-square law, colour temperature and gels. */

/** Stops of change when a light moves from d1 to d2 (positive = brighter at d2). */
export function inverseSquareStops(d1: number, d2: number): number {
  return 2 * Math.log2(d1 / d2);
}

/** Relative intensity at d2 compared with d1 (1 = same). */
export function inverseSquareRatio(d1: number, d2: number): number {
  return (d1 / d2) ** 2;
}

/** Distance needed to change exposure by `stops` relative to d1 (positive = brighter = closer). */
export function distanceForStops(d1: number, stops: number): number {
  return d1 / Math.sqrt(2 ** stops);
}

/** Stops between two power settings (percent or watts, same unit). */
export function powerStops(p1: number, p2: number): number {
  return Math.log2(p2 / p1);
}

export function kelvinToMired(k: number): number {
  return 1e6 / k;
}

export function miredToKelvin(m: number): number {
  return 1e6 / m;
}

/** Mired shift needed to make `source` look like `target` (positive = warming, i.e. CTO). */
export function miredShift(sourceK: number, targetK: number): number {
  return kelvinToMired(targetK) - kelvinToMired(sourceK);
}

export interface Gel {
  name: string;
  mired: number;
  kind: 'cto' | 'ctb' | 'none';
}

/** Lee / Rosco colour-correction gels, nominal mired shifts. */
export const GELS: Gel[] = [
  { name: 'Full CTO', mired: 159, kind: 'cto' },
  { name: '3/4 CTO', mired: 117, kind: 'cto' },
  { name: '1/2 CTO', mired: 81, kind: 'cto' },
  { name: '1/4 CTO', mired: 42, kind: 'cto' },
  { name: '1/8 CTO', mired: 20, kind: 'cto' },
  { name: '1/8 CTB', mired: -12, kind: 'ctb' },
  { name: '1/4 CTB', mired: -30, kind: 'ctb' },
  { name: '1/2 CTB', mired: -68, kind: 'ctb' },
  { name: '3/4 CTB', mired: -98, kind: 'ctb' },
  { name: 'Full CTB', mired: -131, kind: 'ctb' },
  { name: 'Double CTB', mired: -262, kind: 'ctb' },
];

export interface GelSuggestion {
  gels: Gel[];
  mired: number;
  resultK: number;
  errorMired: number;
}

export interface GelAdvice {
  needMired: number;
  single: GelSuggestion;
  pair: GelSuggestion | null;
}

function evaluate(gels: Gel[], sourceK: number, need: number): GelSuggestion {
  const mired = gels.reduce((a, g) => a + g.mired, 0);
  return { gels, mired, resultK: miredToKelvin(kelvinToMired(sourceK) + mired), errorMired: Math.abs(mired - need) };
}

/** Best single gel and best stacked pair (same family) to approximate the needed shift. */
export function suggestGels(sourceK: number, targetK: number): GelAdvice {
  const need = miredShift(sourceK, targetK);
  const singles = GELS.map((g) => evaluate([g], sourceK, need)).sort((a, b) => a.errorMired - b.errorMired);
  const pairs: GelSuggestion[] = [];
  for (let i = 0; i < GELS.length; i++) {
    for (let j = i; j < GELS.length; j++) {
      if (GELS[i].kind !== GELS[j].kind) continue;
      pairs.push(evaluate([GELS[i], GELS[j]], sourceK, need));
    }
  }
  pairs.sort((a, b) => a.errorMired - b.errorMired);
  const single = singles[0];
  const pair = pairs[0] && pairs[0].errorMired < single.errorMired - 1 ? pairs[0] : null;
  return { needMired: need, single, pair };
}

export const COLOUR_TEMP_PRESETS: { name: string; k: number }[] = [
  { name: 'Candle', k: 1900 },
  { name: 'Tungsten', k: 3200 },
  { name: 'Sunrise / sunset', k: 3500 },
  { name: 'Halogen', k: 3400 },
  { name: 'Fluorescent (cool white)', k: 4100 },
  { name: 'Daylight (LED 5600)', k: 5600 },
  { name: 'Midday sun', k: 5500 },
  { name: 'Overcast', k: 6500 },
  { name: 'Open shade', k: 7500 },
  { name: 'Blue sky', k: 10000 },
];
