/* Star exposure rules and star trails. Pixel pitch in microns. */

/** 500 rule: maximum exposure (s) before stars visibly trail, for a crop-adjusted focal length. */
export function rule500(focalMm: number, crop: number, constant = 500): number {
  return constant / (focalMm * crop);
}

/** NPF rule (simplified, declination 0): t = (35 N + 30 p) / f. p in microns. */
export function npfRule(focalMm: number, fNumber: number, pixelPitchUm: number, declinationDeg = 0): number {
  const base = (35 * fNumber + 30 * pixelPitchUm) / focalMm;
  const cosd = Math.cos((declinationDeg * Math.PI) / 180);
  return cosd > 1e-6 ? base / cosd : Infinity;
}

/** Sidereal rate: degrees per second of sky rotation. */
export const SIDEREAL_DEG_PER_S = 360 / 86164.0905;

export interface TrailResult {
  angleDeg: number; // sky rotation during the exposure
  trailMm: number; // length on sensor
  trailPx: number;
}

/** Star trail length during an exposure, at a given declination (0 = celestial equator, longest trails). */
export function starTrail(exposureS: number, focalMm: number, pixelPitchUm: number, declinationDeg = 0): TrailResult {
  const angleDeg = SIDEREAL_DEG_PER_S * exposureS * Math.cos((declinationDeg * Math.PI) / 180);
  const trailMm = focalMm * Math.tan((angleDeg * Math.PI) / 180);
  return { angleDeg, trailMm, trailPx: trailMm / (pixelPitchUm / 1000) };
}

/** Total trail angle for a stacked trail sequence. */
export function trailSequence(frames: number, exposureS: number, intervalS: number): { totalS: number; angleDeg: number } {
  const totalS = frames * Math.max(exposureS, intervalS);
  return { totalS, angleDeg: SIDEREAL_DEG_PER_S * totalS };
}
