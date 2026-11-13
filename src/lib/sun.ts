import * as SunCalc from 'suncalc';

/* suncalc v2: all angles in degrees, azimuth north-based clockwise. Dates are UTC instants. */

export interface DayTimes {
  sunrise: Date;
  sunset: Date;
  solarNoon: Date;
  nadir: Date;
  dawn: Date; // civil dawn
  dusk: Date; // civil dusk
  nauticalDawn: Date;
  nauticalDusk: Date;
  nightEnd: Date; // astronomical dawn
  night: Date; // astronomical dusk
  goldenHourEnd: Date; // morning golden hour ends
  goldenHour: Date; // evening golden hour starts
  blueHourMorning: [Date, Date];
  blueHourEvening: [Date, Date];
  dayLengthMin: number;
  polar: 'none' | 'day' | 'night';
}

export interface MoonInfo {
  rise: Date | null;
  set: Date | null;
  transit: Date | null;
  alwaysUp: boolean;
  alwaysDown: boolean;
  phase: number; // 0..1
  illumination: number; // 0..1
  waxing: boolean;
  phaseName: string;
}

export interface SkyPosition {
  azimuth: number; // degrees, 0 = north, clockwise
  altitude: number; // degrees above horizon
}

const isValid = (d: Date | null | undefined): d is Date => d instanceof Date && !Number.isNaN(d.getTime());
const orInvalid = (d: Date | null | undefined): Date => (isValid(d) ? d : new Date(NaN));

/** Minutes east of UTC for a time zone at a given instant (e.g. Australia/Sydney in January = 660). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((asUtc - date.getTime()) / 60000);
  } catch {
    return -date.getTimezoneOffset();
  }
}

/** Build a Date for a civil date and time in a named time zone. */
export function zonedDate(isoDate: string, time: string, timeZone: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0));
  // Adjust by the zone offset at that instant (two passes handle DST edges).
  let off = tzOffsetMinutes(guess, timeZone);
  let result = new Date(guess.getTime() - off * 60000);
  off = tzOffsetMinutes(result, timeZone);
  result = new Date(guess.getTime() - off * 60000);
  return result;
}

export function sunPosition(date: Date, lat: number, lng: number): SkyPosition {
  const p = SunCalc.getPosition(date, lat, lng);
  return { azimuth: p.azimuth, altitude: p.altitude };
}

export function moonPosition(date: Date, lat: number, lng: number): SkyPosition & { distanceKm: number } {
  const p = SunCalc.getMoonPosition(date, lat, lng);
  return { azimuth: p.azimuth, altitude: p.altitude, distanceKm: p.distance };
}

/** Day times for the civil day containing `date` in the given zone (minutes east of UTC). */
export function dayTimes(date: Date, lat: number, lng: number, utcOffset?: number): DayTimes {
  const raw = SunCalc.getTimes(date, lat, lng, 0, utcOffset);
  const t = {
    sunrise: orInvalid(raw.sunrise),
    sunset: orInvalid(raw.sunset),
    solarNoon: orInvalid(raw.solarNoon),
    nadir: orInvalid(raw.nadir),
    dawn: orInvalid(raw.dawn),
    dusk: orInvalid(raw.dusk),
    nauticalDawn: orInvalid(raw.nauticalDawn),
    nauticalDusk: orInvalid(raw.nauticalDusk),
    nightEnd: orInvalid(raw.nightEnd),
    night: orInvalid(raw.night),
    goldenHourEnd: orInvalid(raw.goldenHourEnd),
    goldenHour: orInvalid(raw.goldenHour),
  };
  // Blue hour: sun between about -6° and -4°, i.e. the first third of civil twilight.
  const blueMorningEnd = isValid(t.sunrise) && isValid(t.dawn) ? new Date(t.dawn.getTime() + (t.sunrise.getTime() - t.dawn.getTime()) * 0.35) : t.sunrise;
  const blueEveningStart = isValid(t.sunset) && isValid(t.dusk) ? new Date(t.dusk.getTime() - (t.dusk.getTime() - t.sunset.getTime()) * 0.35) : t.sunset;
  let polar: DayTimes['polar'] = 'none';
  if (raw.alwaysUp) polar = 'day';
  else if (raw.alwaysDown) polar = 'night';
  else if (!isValid(t.sunrise) || !isValid(t.sunset)) polar = sunPosition(t.solarNoon, lat, lng).altitude > 0 ? 'day' : 'night';
  const dayLengthMin = isValid(t.sunrise) && isValid(t.sunset) ? (t.sunset.getTime() - t.sunrise.getTime()) / 60000 : polar === 'day' ? 1440 : 0;
  return { ...t, blueHourMorning: [t.dawn, blueMorningEnd], blueHourEvening: [blueEveningStart, t.dusk], dayLengthMin, polar };
}

const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

export function moonPhaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.02 || p > 0.98) return PHASES[0];
  if (p < 0.23) return PHASES[1];
  if (p < 0.27) return PHASES[2];
  if (p < 0.48) return PHASES[3];
  if (p < 0.52) return PHASES[4];
  if (p < 0.73) return PHASES[5];
  if (p < 0.77) return PHASES[6];
  return PHASES[7];
}

export function moonInfo(date: Date, lat: number, lng: number, utcOffset?: number): MoonInfo {
  const mt = SunCalc.getMoonTimes(date, lat, lng, utcOffset);
  const ill = SunCalc.getMoonIllumination(date);
  return {
    rise: isValid(mt.rise) ? mt.rise : null,
    set: isValid(mt.set) ? mt.set : null,
    transit: isValid(mt.transit) ? mt.transit : null,
    alwaysUp: !!mt.alwaysUp,
    alwaysDown: !!mt.alwaysDown,
    phase: ill.phase,
    illumination: ill.fraction,
    waxing: ill.waxing,
    phaseName: moonPhaseName(ill.phase),
  };
}

/** Shadow length cast by an object of `height` at sun `altitudeDeg`. Infinite at/below horizon. */
export function shadowLength(height: number, altitudeDeg: number): number {
  if (altitudeDeg <= 0) return Infinity;
  return height / Math.tan((altitudeDeg * Math.PI) / 180);
}

/** Great-circle distance in metres and initial bearing in degrees between two points. */
export function geoDistanceBearing(lat1: number, lng1: number, lat2: number, lng2: number): { distance: number; bearing: number } {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const distance = 2 * R * Math.asin(Math.sqrt(a));
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return { distance, bearing };
}

/** Destination point given start, bearing (deg) and distance (m). */
export function geoDestination(lat: number, lng: number, bearingDeg: number, distance: number): { lat: number; lng: number } {
  const R = 6371008.8;
  const δ = distance / R;
  const θ = (bearingDeg * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lng * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: (φ2 * 180) / Math.PI, lng: (((λ2 * 180) / Math.PI + 540) % 360) - 180 };
}
