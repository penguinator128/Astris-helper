/* Timecode and frame maths, including drop-frame for 29.97 and 59.94. */

export interface Timecode {
  h: number;
  m: number;
  s: number;
  f: number;
}

export function isDropFrameRate(fps: number): boolean {
  return Math.abs(fps - 29.97) < 0.01 || Math.abs(fps - 59.94) < 0.01;
}

/** Nominal integer frame rate used for timecode counting (29.97 -> 30). */
export function nominalFps(fps: number): number {
  return Math.round(fps);
}

export function framesToTimecode(totalFrames: number, fps: number, dropFrame = false): Timecode {
  const nf = nominalFps(fps);
  let frames = Math.max(0, Math.round(totalFrames));
  if (dropFrame && isDropFrameRate(fps)) {
    const dropPerMin = nf === 30 ? 2 : 4;
    const framesPer10Min = Math.round(fps * 60 * 10);
    const framesPerMin = nf * 60 - dropPerMin;
    const d = Math.floor(frames / framesPer10Min);
    const m = frames % framesPer10Min;
    if (m > dropPerMin) frames += dropPerMin * 9 * d + dropPerMin * Math.floor((m - dropPerMin) / framesPerMin);
    else frames += dropPerMin * 9 * d;
  }
  const f = frames % nf;
  const s = Math.floor(frames / nf) % 60;
  const m = Math.floor(frames / (nf * 60)) % 60;
  const h = Math.floor(frames / (nf * 3600)) % 24;
  return { h, m, s, f };
}

export function timecodeToFrames(tc: Timecode, fps: number, dropFrame = false): number {
  const nf = nominalFps(fps);
  let frames = tc.h * 3600 * nf + tc.m * 60 * nf + tc.s * nf + tc.f;
  if (dropFrame && isDropFrameRate(fps)) {
    const dropPerMin = nf === 30 ? 2 : 4;
    const totalMinutes = tc.h * 60 + tc.m;
    frames -= dropPerMin * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return frames;
}

export function formatTimecode(tc: Timecode, dropFrame = false): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(tc.h)}:${p(tc.m)}:${p(tc.s)}${dropFrame ? ';' : ':'}${p(tc.f)}`;
}

export function parseTimecode(text: string): Timecode | null {
  const m = text.trim().match(/^(\d{1,2})[:;.](\d{1,2})[:;.](\d{1,2})[:;.](\d{1,3})$/);
  if (!m) return null;
  return { h: +m[1], m: +m[2], s: +m[3], f: +m[4] };
}

export function addTimecodes(a: Timecode, b: Timecode, fps: number, dropFrame = false): Timecode {
  return framesToTimecode(timecodeToFrames(a, fps, dropFrame) + timecodeToFrames(b, fps, dropFrame), fps, dropFrame);
}

export function subtractTimecodes(a: Timecode, b: Timecode, fps: number, dropFrame = false): Timecode {
  return framesToTimecode(Math.max(0, timecodeToFrames(a, fps, dropFrame) - timecodeToFrames(b, fps, dropFrame)), fps, dropFrame);
}

/** Real-time seconds represented by a frame count at a true frame rate. */
export function framesToSeconds(frames: number, fps: number): number {
  return frames / fps;
}

export const FRAME_RATES = [23.976, 24, 25, 29.97, 30, 48, 50, 59.94, 60, 100, 120];
