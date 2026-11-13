/* Shutter angle, frame rate, slow motion, time lapse. */

/** Shutter time in seconds for a shutter angle at a frame rate. */
export function shutterFromAngle(angleDeg: number, fps: number): number {
  return angleDeg / (360 * fps);
}

export function angleFromShutter(shutterS: number, fps: number): number {
  return 360 * fps * shutterS;
}

export interface SlowMotionResult {
  speedPercent: number; // playback speed as a percentage of real time
  slowFactor: number; // e.g. 2.5x slower
  recommendedShutter: number; // seconds at 180°
  clipSecondsPerRealSecond: number;
}

export function slowMotion(shootFps: number, playbackFps: number): SlowMotionResult {
  const slowFactor = shootFps / playbackFps;
  return {
    speedPercent: (playbackFps / shootFps) * 100,
    slowFactor,
    recommendedShutter: shutterFromAngle(180, shootFps),
    clipSecondsPerRealSecond: slowFactor,
  };
}

export interface TimelapseInput {
  intervalS: number;
  clipS: number; // desired clip length
  playbackFps: number;
  fileSizeMb: number; // per frame
}

export interface TimelapseResult {
  frames: number;
  shootS: number;
  clipS: number;
  storageGb: number;
  speedup: number; // how many times faster than real time
}

/** Given interval, clip length and playback fps, work out frames, shoot time and storage. */
export function timelapseFromClip(i: TimelapseInput): TimelapseResult {
  const frames = Math.ceil(i.clipS * i.playbackFps);
  const shootS = frames * i.intervalS;
  return { frames, shootS, clipS: frames / i.playbackFps, storageGb: (frames * i.fileSizeMb) / 1000, speedup: i.intervalS * i.playbackFps };
}

/** Given interval, shoot time and playback fps, work out frames, clip length and storage. */
export function timelapseFromShoot(intervalS: number, shootS: number, playbackFps: number, fileSizeMb: number): TimelapseResult {
  const frames = Math.floor(shootS / intervalS);
  return { frames, shootS: frames * intervalS, clipS: frames / playbackFps, storageGb: (frames * fileSizeMb) / 1000, speedup: intervalS * playbackFps };
}

export const TIMELAPSE_INTERVALS: { subject: string; interval: string; seconds: [number, number] }[] = [
  { subject: 'Fast clouds, busy traffic', interval: '1–2 s', seconds: [1, 2] },
  { subject: 'Slow clouds, people in a square', interval: '2–5 s', seconds: [2, 5] },
  { subject: 'Sunset and sunrise', interval: '3–10 s', seconds: [3, 10] },
  { subject: 'Shadows crossing a scene', interval: '10–30 s', seconds: [10, 30] },
  { subject: 'Stars and Milky Way', interval: '20–40 s', seconds: [20, 40] },
  { subject: 'Flowers opening', interval: '2–5 min', seconds: [120, 300] },
  { subject: 'Construction, long projects', interval: '5–30 min', seconds: [300, 1800] },
];
