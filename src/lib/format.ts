import type { TimeFormat, Units } from '@/types/settings';

export const M_PER_FT = 0.3048;

export function round(v: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

/** Format a number with sensible significant digits for readouts. */
export function fmtNum(v: number, decimals?: number): string {
  if (!Number.isFinite(v)) return v === Infinity ? '∞' : '—';
  if (decimals != null) return v.toFixed(decimals);
  const abs = Math.abs(v);
  if (abs === 0) return '0';
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 100) return v.toFixed(1);
  if (abs >= 10) return v.toFixed(2);
  if (abs >= 1) return v.toFixed(2);
  if (abs >= 0.1) return v.toFixed(3);
  return v.toFixed(4);
}

/** Format a length in metres for the user's unit preference. */
export function fmtLength(metres: number, units: Units, decimals?: number): string {
  if (!Number.isFinite(metres)) return metres === Infinity ? '∞' : '—';
  if (units === 'imperial') {
    const ft = metres / M_PER_FT;
    if (ft < 1) return `${fmtNum(ft * 12, decimals ?? 1)} in`;
    return `${fmtNum(ft, decimals)} ft`;
  }
  if (Math.abs(metres) < 1) return `${fmtNum(metres * 100, decimals ?? 1)} cm`;
  return `${fmtNum(metres, decimals)} m`;
}

export function lengthUnit(units: Units): string {
  return units === 'imperial' ? 'ft' : 'm';
}

export function toDisplayLength(metres: number, units: Units): number {
  return units === 'imperial' ? metres / M_PER_FT : metres;
}

export function fromDisplayLength(v: number, units: Units): number {
  return units === 'imperial' ? v * M_PER_FT : v;
}

/** Format shutter speed in seconds as a fraction or seconds string. */
export function fmtShutter(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds >= 1) {
    if (seconds >= 60) {
      const m = Math.floor(seconds / 60);
      const s = seconds - m * 60;
      return s > 0.05 ? `${m} min ${fmtNum(s, 1)} s` : `${m} min`;
    }
    return `${fmtNum(seconds, seconds >= 10 ? 1 : 2)} s`;
  }
  const denom = 1 / seconds;
  const rounded = denom >= 100 ? Math.round(denom) : Math.round(denom * 10) / 10;
  return `1/${rounded} s`;
}

export function fmtAperture(f: number): string {
  if (!Number.isFinite(f)) return '—';
  return `f/${f < 10 ? round(f, 1) : round(f, 0)}`;
}

export function fmtDegrees(d: number, decimals = 1): string {
  return `${fmtNum(d, decimals)}°`;
}

export function fmtTime(date: Date, timeFormat: TimeFormat, timeZone?: string, withSeconds = false): string {
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: timeFormat === '12h',
    timeZone,
  })
    .format(date)
    .replace(/\s?(am|pm)/i, (m) => m.toLowerCase());
}

export function fmtDate(date: Date, timeZone?: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone, ...opts }).format(date);
}

export function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function fmtBytes(gb: number): string {
  if (!Number.isFinite(gb)) return '—';
  if (gb >= 1000) return `${fmtNum(gb / 1000, 2)} TB`;
  if (gb >= 1) return `${fmtNum(gb, gb >= 100 ? 0 : 1)} GB`;
  return `${fmtNum(gb * 1000, 0)} MB`;
}

export function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, '0');
}

export function todayIso(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function compass(bearing: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const idx = Math.round((((bearing % 360) + 360) % 360) / 22.5) % 16;
  return dirs[idx];
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Parse shutter text like "1/50", "1/50 s", "0.5", "2s", "30\"" into seconds. */
export function parseShutter(text: string): number {
  const t = text.trim().toLowerCase().replace(/s$/, '').replace(/"$/, '').trim();
  const frac = t.match(/^1\s*\/\s*([0-9.]+)$/);
  if (frac) {
    const d = parseFloat(frac[1]);
    return d > 0 ? 1 / d : NaN;
  }
  const n = parseFloat(t);
  return Number.isFinite(n) && n > 0 ? n : NaN;
}
