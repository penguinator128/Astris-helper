/* Exposure value, reciprocity, ND filters. */

/** Exposure value for a given aperture, shutter (s) and ISO: EV at the scene level (ISO-100 referenced). */
export function exposureValue(fNumber: number, shutterS: number, iso = 100): number {
  return Math.log2((fNumber * fNumber) / shutterS) - Math.log2(iso / 100);
}

export function shutterFromEv(ev: number, fNumber: number, iso = 100): number {
  return (fNumber * fNumber) / 2 ** (ev + Math.log2(iso / 100));
}

export function apertureFromEv(ev: number, shutterS: number, iso = 100): number {
  return Math.sqrt(shutterS * 2 ** (ev + Math.log2(iso / 100)));
}

export function isoFromEv(ev: number, fNumber: number, shutterS: number): number {
  return 100 * 2 ** (Math.log2((fNumber * fNumber) / shutterS) - ev);
}

/** Stops difference between two exposures (positive = second is brighter). */
export function stopsBetween(a: { f: number; t: number; iso: number }, b: { f: number; t: number; iso: number }): number {
  return exposureValue(a.f, a.t, a.iso) - exposureValue(b.f, b.t, b.iso);
}

/** Convert ND optical density to stops. */
export function densityToStops(density: number): number {
  return density / Math.log10(2);
}

export function stopsToDensity(stops: number): number {
  return stops * Math.log10(2);
}

export function stopsToFactor(stops: number): number {
  return 2 ** stops;
}

export function factorToStops(factor: number): number {
  return Math.log2(factor);
}

/** New shutter time after adding `stops` of ND (reciprocity, no compensation). */
export function ndShutter(baseShutterS: number, stops: number): number {
  return baseShutterS * 2 ** stops;
}

export interface NdPreset {
  label: string;
  stops: number;
  density: number;
  factor: number;
}

export const ND_PRESETS: NdPreset[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((stops) => ({
  label: stops <= 3 ? `ND${2 ** stops}` : stops === 10 ? 'ND1000' : `ND${Math.round(2 ** stops)}`,
  stops,
  density: Math.round(stopsToDensity(stops) * 100) / 100,
  factor: 2 ** stops,
}));

/** Nearest standard shutter speed (1/3 stop scale) for a time in seconds. */
export const STANDARD_SHUTTERS = [
  30, 25, 20, 15, 13, 10, 8, 6, 5, 4, 3.2, 2.5, 2, 1.6, 1.3, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 1 / 4, 1 / 5, 1 / 6, 1 / 8, 1 / 10, 1 / 13, 1 / 15, 1 / 20, 1 / 25, 1 / 30, 1 / 40,
  1 / 50, 1 / 60, 1 / 80, 1 / 100, 1 / 125, 1 / 160, 1 / 200, 1 / 250, 1 / 320, 1 / 400, 1 / 500, 1 / 640, 1 / 800, 1 / 1000, 1 / 1250, 1 / 1600, 1 / 2000, 1 / 2500, 1 / 3200, 1 / 4000, 1 / 8000,
];

export function nearestStandardShutter(seconds: number): number {
  let best = STANDARD_SHUTTERS[0];
  let bestErr = Infinity;
  for (const s of STANDARD_SHUTTERS) {
    const err = Math.abs(Math.log2(s / seconds));
    if (err < bestErr) {
      bestErr = err;
      best = s;
    }
  }
  return best;
}

export const STANDARD_APERTURES = [1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];

export const EV_TABLE: { ev: number; scene: string }[] = [
  { ev: -6, scene: 'Night, away from city lights, starlight' },
  { ev: -4, scene: 'Night, faint moonlight' },
  { ev: -2, scene: 'Night under a full moon, snow' },
  { ev: 0, scene: 'Dim interior, candle-lit' },
  { ev: 2, scene: 'Distant lit buildings at night' },
  { ev: 4, scene: 'Floodlit sports, neon signs' },
  { ev: 5, scene: 'Home interior, average lamp light' },
  { ev: 6, scene: 'Bright interior, office' },
  { ev: 7, scene: 'Brightly lit shop, stage' },
  { ev: 8, scene: 'Overcast sunset, bright street at night' },
  { ev: 9, scene: 'Just after sunset, landscape' },
  { ev: 10, scene: 'Golden hour, heavy overcast' },
  { ev: 11, scene: 'Overcast, no shadows' },
  { ev: 12, scene: 'Open shade, bright cloudy' },
  { ev: 13, scene: 'Hazy sun, soft shadows' },
  { ev: 14, scene: 'Bright sun, distinct shadows' },
  { ev: 15, scene: 'Full sun, Sunny 16' },
  { ev: 16, scene: 'Sun on sand or snow' },
];
