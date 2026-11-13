/* Optics: depth of field, field of view, hyperfocal, framing, equivalence, dolly zoom, anamorphic.
   All lengths in millimetres unless the name says metres. Angles in degrees. */

const DEG = 180 / Math.PI;

/** Hyperfocal distance in metres. f, coc in mm. */
export function hyperfocal(focalMm: number, fNumber: number, cocMm: number): number {
  return ((focalMm * focalMm) / (fNumber * cocMm) + focalMm) / 1000;
}

export interface DofResult {
  hyperfocal: number; // m
  near: number; // m
  far: number; // m (Infinity if beyond hyperfocal)
  total: number; // m (Infinity if far is infinite)
  inFront: number; // m
  behind: number; // m
}

/** Classic thin-lens depth of field. subjectM in metres. */
export function depthOfField(focalMm: number, fNumber: number, subjectM: number, cocMm: number): DofResult {
  const H = hyperfocal(focalMm, fNumber, cocMm) * 1000; // mm
  const s = subjectM * 1000;
  const f = focalMm;
  const near = (s * (H - f)) / (H + s - 2 * f);
  const far = s >= H ? Infinity : (s * (H - f)) / (H - s);
  const nearM = near / 1000;
  const farM = far === Infinity ? Infinity : far / 1000;
  return {
    hyperfocal: H / 1000,
    near: nearM,
    far: farM,
    total: farM === Infinity ? Infinity : farM - nearM,
    inFront: subjectM - nearM,
    behind: farM === Infinity ? Infinity : farM - subjectM,
  };
}

/** Aperture required for a given total depth of field around a subject (bisection). Returns NaN if impossible. */
export function apertureForDof(focalMm: number, subjectM: number, desiredTotalM: number, cocMm: number): number {
  let lo = 0.7;
  let hi = 128;
  const at = (N: number) => depthOfField(focalMm, N, subjectM, cocMm).total;
  if (at(lo) >= desiredTotalM) return lo;
  if (at(hi) < desiredTotalM) return NaN;
  for (let i = 0; i < 60; i++) {
    const mid = Math.sqrt(lo * hi);
    if (at(mid) >= desiredTotalM) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Subject distance that yields a desired total depth of field at a given aperture (bisection). */
export function distanceForDof(focalMm: number, fNumber: number, desiredTotalM: number, cocMm: number): number {
  const H = hyperfocal(focalMm, fNumber, cocMm);
  let lo = focalMm / 1000 + 0.001;
  let hi = H * 0.999;
  const at = (s: number) => depthOfField(focalMm, fNumber, s, cocMm).total;
  if (at(hi) < desiredTotalM) return NaN;
  if (at(lo) >= desiredTotalM) return lo;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) >= desiredTotalM) hi = mid;
    else lo = mid;
  }
  return hi;
}

export interface FovResult {
  horizontal: number; // degrees
  vertical: number;
  diagonal: number;
}

/** Angular field of view for a rectilinear lens focused at infinity. */
export function fieldOfView(focalMm: number, sensorW: number, sensorH: number): FovResult {
  const a = (d: number) => 2 * Math.atan(d / (2 * focalMm)) * DEG;
  return { horizontal: a(sensorW), vertical: a(sensorH), diagonal: a(Math.hypot(sensorW, sensorH)) };
}

/** Scene width/height covered at a distance (metres), using the thin-lens magnification. */
export function sceneSizeAtDistance(focalMm: number, sensorW: number, sensorH: number, distanceM: number): { width: number; height: number } {
  const d = distanceM * 1000;
  const m = focalMm / Math.max(d - focalMm, 1e-6); // magnification
  return { width: sensorW / m / 1000, height: sensorH / m / 1000 };
}

/** Focal length needed to cover a scene width (metres) at a distance (metres). */
export function focalForSceneWidth(sensorW: number, sceneWidthM: number, distanceM: number): number {
  const d = distanceM * 1000;
  const W = sceneWidthM * 1000;
  // W = sensorW * (d - f) / f  ->  f = sensorW * d / (W + sensorW)
  return (sensorW * d) / (W + sensorW);
}

/** Distance (metres) so that a subject of `subjectM` height fills `fraction` of the frame height. */
export function distanceForSubject(focalMm: number, sensorDimMm: number, subjectM: number, fraction = 1): number {
  const S = subjectM * 1000;
  const target = sensorDimMm * fraction; // image size on sensor
  // magnification m = target / S ; d = f (1 + 1/m)
  const m = target / S;
  return (focalMm * (1 + 1 / m)) / 1000;
}

/** Equivalent focal length and aperture when moving a lens from sensor A to sensor B (same framing and DoF). */
export function lensEquivalence(focalMm: number, fNumber: number, cropA: number, cropB: number): { focal: number; aperture: number } {
  const k = cropA / cropB;
  return { focal: focalMm * k, aperture: fNumber * k };
}

/** Dolly zoom: focal length needed at a new distance to keep subject size constant. */
export function dollyZoomFocal(focal1: number, distance1: number, distance2: number): number {
  return (focal1 * distance2) / distance1;
}

export interface AnamorphicResult {
  capturedAspect: number;
  desqueezedAspect: number;
  deliveryWidth: number;
  deliveryHeight: number;
}

export function anamorphic(squeeze: number, recWidthPx: number, recHeightPx: number): AnamorphicResult {
  const capturedAspect = recWidthPx / recHeightPx;
  const desqueezedAspect = capturedAspect * squeeze;
  return {
    capturedAspect,
    desqueezedAspect,
    deliveryWidth: Math.round(recWidthPx * squeeze),
    deliveryHeight: recHeightPx,
  };
}

/** Diameter of the blur disc (mm on sensor) for a background at infinity. */
export function backgroundBlurDiscMm(focalMm: number, fNumber: number, subjectM: number): number {
  const s = subjectM * 1000;
  if (s <= focalMm) return Infinity;
  return (focalMm * focalMm) / (fNumber * (s - focalMm));
}

/** Blur disc as a fraction of the frame width — 0.02 is already clearly soft. */
export function backgroundBlurFraction(focalMm: number, fNumber: number, subjectM: number, sensorW: number): number {
  return backgroundBlurDiscMm(focalMm, fNumber, subjectM) / sensorW;
}

export function describeBlur(fraction: number): string {
  if (!Number.isFinite(fraction)) return 'Not focusable';
  if (fraction < 0.004) return 'Background sharp';
  if (fraction < 0.01) return 'Slight softness';
  if (fraction < 0.02) return 'Soft background';
  if (fraction < 0.04) return 'Strong separation';
  return 'Very shallow';
}
