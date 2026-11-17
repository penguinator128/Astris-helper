import type { CameraConfig, GearItem, LensSpec } from '@/types/project';
import { body as bodyById, guessBody, type CameraBody } from './bodies';
import { profile } from './profiles';
import { maxApertureAt } from './lenses';
import { getSensor, circleOfConfusion, type Sensor } from '@/lib/calc/sensors';
import { depthOfField, fieldOfView } from '@/lib/calc/optics';
import { kelvinToRgb } from '@/lib/colour/kelvin';

export const REF = { aperture: 2.8, shutter: 1 / 48, iso: 800 };

export function defaultConfig(b: CameraBody, lens?: LensSpec): CameraConfig {
  const codec = b.codecs[0];
  const fps = 25;
  return {
    bodyId: b.id,
    manufacturer: b.manufacturer,
    model: b.model,
    mount: b.mount,
    sensorId: b.sensorId,
    focalLength: lens ? lens.focalMin : 35,
    aperture: lens ? lens.maxAperture : 2.8,
    shutterMode: 'angle',
    shutterAngle: 180,
    shutterSpeed: 1 / 50,
    iso: b.nativeIso[0],
    ei: b.nativeIso[0],
    kelvin: 5600,
    tint: 0,
    focusMode: 'MF',
    focusDistance: 2,
    resolution: b.resolutions[0].label,
    fps,
    codec: codec.name,
    format: codec.format,
    profile: b.profiles[0],
    colourSpace: b.colourSpaces[0],
    bitDepth: codec.bitDepths[codec.bitDepths.length - 1],
    chroma: codec.chroma[0],
    stabilisation: b.stabilisation[0],
    monitorLut: true,
    height: 1.5,
    tilt: 0,
    panSpeed: 0,
    subjectSpeed: 0,
    notes: '',
  };
}

/** The camera settings for a camera gear item, filling in defaults for items made before settings existed. */
export function cameraConfig(g: GearItem): CameraConfig {
  if (g.camera) return g.camera;
  return defaultConfig(guessBody(g.model || g.name));
}

export function shutterSeconds(c: CameraConfig): number {
  return c.shutterMode === 'angle' ? c.shutterAngle / (360 * c.fps) : c.shutterSpeed;
}
export function shutterAngleOf(c: CameraConfig): number {
  return c.shutterMode === 'angle' ? c.shutterAngle : c.shutterSpeed * 360 * c.fps;
}

/** Keep every setting valid for the body and lens after any change. */
export function normalise(c: CameraConfig, lens?: LensSpec): CameraConfig {
  const b = bodyById(c.bodyId);
  const out = { ...c };
  out.iso = Math.min(b.isoRange[1], Math.max(b.isoRange[0], Math.round(out.iso)));
  out.ei = b.usesEI ? Math.min(b.isoRange[1], Math.max(b.isoRange[0], out.ei)) : out.iso;
  const res = b.resolutions.find((r) => r.label === out.resolution) ?? b.resolutions[0];
  out.resolution = res.label;
  if (out.fps > res.maxFps) out.fps = b.fpsOptions.filter((f) => f <= res.maxFps).slice(-1)[0] ?? 25;
  const codec = b.codecs.find((k) => k.name === out.codec) ?? b.codecs[0];
  out.codec = codec.name;
  out.format = codec.format;
  if (!b.profiles.includes(out.profile)) out.profile = b.profiles[0];
  const prof = profile(out.profile);
  // Log and HDR want the deepest bit depth the codec offers.
  if (!codec.bitDepths.includes(out.bitDepth) || ((prof.kind === 'log' || prof.kind === 'hdr') && codec.bitDepths.includes('10-bit') && out.bitDepth === '8-bit')) out.bitDepth = codec.bitDepths[codec.bitDepths.length - 1];
  if (!codec.chroma.includes(out.chroma)) out.chroma = codec.chroma[0];
  if (!b.colourSpaces.includes(out.colourSpace)) out.colourSpace = b.colourSpaces[0];
  if (!b.stabilisation.includes(out.stabilisation)) out.stabilisation = b.stabilisation[0];
  out.shutterAngle = Math.min(360, Math.max(1, out.shutterAngle));
  out.shutterSpeed = Math.min(1 / out.fps, Math.max(1 / 16000, out.shutterSpeed));
  if (lens) {
    out.focalLength = Math.min(lens.focalMax, Math.max(lens.focalMin, out.focalLength));
    out.aperture = Math.min(lens.minAperture, Math.max(maxApertureAt(lens, out.focalLength), out.aperture));
    out.focusDistance = Math.max(lens.minFocus, out.focusDistance);
  }
  out.kelvin = Math.min(10000, Math.max(2000, out.kelvin));
  out.tint = Math.min(99, Math.max(-99, out.tint));
  return out;
}

export interface Warning {
  level: 'info' | 'warn';
  text: string;
}

export function warnings(c: CameraConfig, lens?: LensSpec): Warning[] {
  const b = bodyById(c.bodyId);
  const prof = profile(c.profile);
  const out: Warning[] = [];
  const t = shutterSeconds(c);
  const angle = shutterAngleOf(c);
  if (!lens) out.push({ level: 'warn', text: 'No lens attached. Attach one to get accurate field of view and depth of field.' });
  if (prof.kind === 'log' && c.bitDepth === '8-bit') out.push({ level: 'warn', text: `${prof.name} in 8-bit can band in skies and skin when graded. Use a 10-bit codec if you can.` });
  if (prof.minIso && c.iso < prof.minIso) out.push({ level: 'warn', text: `${prof.name} is rated from ISO ${prof.minIso}. Below that you lose highlight range.` });
  if (b.nativeIso.length > 1 && !b.nativeIso.includes(c.iso)) {
    const nearest = b.nativeIso.reduce((a, n) => (Math.abs(Math.log2(n / c.iso)) < Math.abs(Math.log2(a / c.iso)) ? n : a));
    out.push({ level: 'info', text: `This body has dual native ISO ${b.nativeIso.join(' and ')}. ISO ${nearest} is the cleanest near your setting.` });
  }
  // Australia runs mains at 50 Hz; LED and fluorescent fixtures flicker at 100 Hz.
  const flickerSafe = Math.abs(t * 100 - Math.round(t * 100)) < 0.02 && t >= 1 / 100;
  if (!flickerSafe) out.push({ level: 'warn', text: `${t >= 1 ? t.toFixed(1) + ' s' : '1/' + Math.round(1 / t)} may flicker under 50 Hz mains lighting. 1/50 or 1/100 is safe (172.8° at 24 fps).` });
  if (angle < 90) out.push({ level: 'info', text: `${Math.round(angle)}° shutter gives crisp, staccato motion.` });
  if (angle > 270) out.push({ level: 'info', text: `${Math.round(angle)}° shutter gives smeary motion.` });
  if (c.fps > 30 && t > 1 / (2 * c.fps) + 1e-6) out.push({ level: 'info', text: `At ${c.fps} fps a 180° shutter is 1/${Math.round(2 * c.fps)}.` });
  if (b.note) out.push({ level: 'info', text: b.note });
  return out;
}

export interface Derived {
  sensor: Sensor;
  hfov: number;
  vfov: number;
  dof: ReturnType<typeof depthOfField>;
  shutter: number;
  angle: number;
  cameraStops: number; // exposure relative to f/2.8, 1/48, ISO 800
  noiseStops: number; // ISO above the nearest lower native ISO
  noiseLabel: string;
  subjectBlurPx: number;
  panBlurPx: number;
  cocMm: number;
}

/** Everything the readouts and the preview need, calculated from the settings. */
export function derive(c: CameraConfig, imageWidthPx = 1920): Derived {
  const b = bodyById(c.bodyId);
  const sensor = getSensor(c.sensorId);
  const fov = fieldOfView(c.focalLength, sensor.width, sensor.height);
  const coc = circleOfConfusion(sensor);
  const dof = depthOfField(c.focalLength, c.aperture, c.focusDistance, coc);
  const t = shutterSeconds(c);
  const cameraStops = Math.log2(c.iso / REF.iso) + Math.log2(t / REF.shutter) - 2 * Math.log2(c.aperture / REF.aperture) - (c.ndStops ?? 0);
  const lowerNative = b.nativeIso.filter((n) => n <= c.iso).slice(-1)[0] ?? b.nativeIso[0];
  const noiseStops = Math.max(0, Math.log2(c.iso / lowerNative));
  const noiseLabel = noiseStops < 1 ? 'Clean' : noiseStops < 3 ? 'Light grain' : noiseStops < 5 ? 'Visible noise' : 'Heavy noise';
  // Width of scene covered at the focus distance, for subject motion blur.
  const sceneW = (sensor.width * (c.focusDistance * 1000 - c.focalLength)) / c.focalLength / 1000;
  const subjectBlurPx = (c.subjectSpeed * t / Math.max(0.01, sceneW)) * imageWidthPx;
  const panBlurPx = ((c.panSpeed * t) / fov.horizontal) * imageWidthPx;
  return { sensor, hfov: fov.horizontal, vfov: fov.vertical, dof, shutter: t, angle: shutterAngleOf(c), cameraStops, noiseStops, noiseLabel, subjectBlurPx, panBlurPx, cocMm: coc };
}

/** RGB gains that white-balance the image for the camera's kelvin and tint (green fixed at 1). */
export function whiteBalanceGains(kelvin: number, tint: number): [number, number, number] {
  const [r, g, b] = kelvinToRgb(kelvin);
  const gr = g / Math.max(1, r);
  const gb = g / Math.max(1, b);
  const gg = 1 - tint * 0.004;
  return [gr, gg, gb];
}

/** Mired difference between the scene light and the camera white balance (positive = image looks warm). */
export function wbOffsetMired(sceneKelvin: number, cameraKelvin: number): number {
  return 1e6 / sceneKelvin - 1e6 / cameraKelvin;
}

export const STOPS = [0.95, 1, 1.2, 1.4, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
export const ISOS = [50, 64, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200, 64000, 80000, 102400];

/** Relative subject light where f/2.8, 1/48 s, ISO 800 gives a normal exposure (about 200 lux). */
export const REF_LIGHT = 0.25;

/** Stops over (+) or under (−) a normal exposure, from the light on the subject and the camera settings. */
export function exposureOffset(c: CameraConfig, subjectLight: number): number {
  if (subjectLight <= 0) return -Infinity;
  return Math.log2(subjectLight / REF_LIGHT) + derive(c).cameraStops;
}

export function exposureLabel(off: number): { text: string; level: 'ok' | 'warn' | 'bad' } {
  if (!Number.isFinite(off)) return { text: 'No light on the subject', level: 'bad' };
  const v = Math.abs(off) < 0.05 ? 0 : off;
  const s = `${v > 0 ? '+' : ''}${v.toFixed(1)} stops`;
  if (Math.abs(off) <= 0.5) return { text: `${s} · good`, level: 'ok' };
  if (off > 2.5) return { text: `${s} · highlights will clip`, level: 'bad' };
  if (off < -2.5) return { text: `${s} · very dark, noisy`, level: 'bad' };
  return { text: `${s} · ${off > 0 ? 'bright' : 'dark'}`, level: 'warn' };
}

const nearest = (list: number[], v: number) => list.reduce((a, x) => (Math.abs(Math.log2(x / v)) < Math.abs(Math.log2(a / v)) ? x : a));

/**
 * Bring the exposure to normal without touching the shutter (it sets the motion look):
 * ISO back towards native first, then ND, then ISO further, then aperture.
 */
export function balanceExposure(c: CameraConfig, subjectLight: number, lens: LensSpec | undefined, ndMax: number): CameraConfig {
  const b = bodyById(c.bodyId);
  const prof = profile(c.profile);
  let need = -exposureOffset(c, subjectLight); // stops to add
  if (!Number.isFinite(need)) return c;
  const out = { ...c };
  const isoList = ISOS.filter((i) => i >= Math.max(b.isoRange[0], prof.minIso ?? 0) && i <= b.isoRange[1]);
  const native = b.nativeIso.reduce((a, n) => (Math.abs(Math.log2(n / out.iso)) < Math.abs(Math.log2(a / out.iso)) ? n : a));
  const towardNative = need < 0 ? Math.max(Math.log2(native / out.iso), need) : Math.min(Math.log2(native / out.iso), need);
  if ((need < 0 && out.iso > native) || (need > 0 && out.iso < native)) {
    const iso1 = nearest(isoList, out.iso * Math.pow(2, towardNative));
    need -= Math.log2(iso1 / out.iso);
    out.iso = iso1;
    out.ei = iso1;
  }
  if (ndMax > 0) {
    const nd0 = out.ndStops ?? 0;
    const nd = Math.min(ndMax, Math.max(0, Math.round((nd0 - need) * 3) / 3));
    need += nd - nd0;
    out.ndStops = nd;
  }
  const iso = nearest(isoList, out.iso * Math.pow(2, need));
  need -= Math.log2(iso / out.iso);
  out.iso = iso;
  out.ei = iso;
  const widest = lens ? maxApertureAt(lens, out.focalLength) : 1.4;
  const tightest = lens ? lens.minAperture : 22;
  const n = nearest(STOPS.filter((s) => s >= widest - 1e-6 && s <= tightest), out.aperture / Math.pow(2, need / 2));
  out.aperture = n;
  return normalise(out, lens);
}
