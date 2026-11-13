import * as SunCalc from 'suncalc';

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
  alwaysUp: boolean;
  alwaysDown: boolean;
  phase: number; // 0..1
  illumination: number; // 0..1
  phaseName: string;
}

export interface SkyPosition {
  azimuth: number; // degrees, 0 = north, clockwise
  altitude: number; // degrees above horizon
}

const isValid = (d: Date) => d instanceof Date && !Number.isNaN(d.getTime());

/** suncalc azimuth is measured from south, clockwise, in radians. Convert to compass degrees from north. */
export function toCompassDeg(azRad: number): number {
  return (((azRad * 180) / Math.PI + 180) % 360 + 360) % 360;
}

export function sunPosition(date: Date, lat: number, lng: number): SkyPosition {
  const p = SunCalc.getPosition(date, lat, lng);
  return { azimuth: toCompassDeg(p.azimuth), altitude: (p.altitude * 180) / Math.PI };
}

export function moonPosition(date: Date, lat: number, lng: number): SkyPosition & { distanceKm: number } {
  const p = SunCalc.getMoonPosition(date, lat, lng);
  return { azimuth: toCompassDeg(p.azimuth), altitude: (p.altitude * 180) / Math.PI, distanceKm: p.distance };
}

/** Get day times for the local calendar day containing `date` (noon is used to avoid DST edge cases). */
export function dayTimes(date: Date, lat: number, lng: number): DayTimes {
  const noon = new Date(date);
  noon.setHours(12, 0, 0, 0);
  const raw = SunCalc.getTimes(noon, lat, lng);
  const d = (x: Date | null | undefined): Date => (x && isValid(x) ? x : new Date(NaN));
  const t = {
    sunrise: d(raw.sunrise),
    sunset: d(raw.sunset),
    solarNoon: d(raw.solarNoon),
    nadir: d(raw.nadir),
    dawn: d(raw.dawn),
    dusk: d(raw.dusk),
    nauticalDawn: d(raw.nauticalDawn),
    nauticalDusk: d(raw.nauticalDusk),
    nightEnd: d(raw.nightEnd),
    night: d(raw.night),
    goldenHourEnd: d(raw.goldenHourEnd),
    goldenHour: d(raw.goldenHour),
  };
  // Blue hour: sun roughly between -6° and -4°. Approximate as the first third of civil twilight.
  const blueMorningEnd = isValid(t.sunrise) && isValid(t.dawn) ? new Date(t.dawn.getTime() + (t.sunrise.getTime() - t.dawn.getTime()) * 0.35) : t.sunrise;
  const blueEveningStart = isValid(t.sunset) && isValid(t.dusk) ? new Date(t.dusk.getTime() - (t.dusk.getTime() - t.sunset.getTime()) * 0.35) : t.sunset;
  let polar: DayTimes['polar'] = 'none';
  if (!isValid(t.sunrise) || !isValid(t.sunset)) {
    const alt = sunPosition(noon, lat, lng).altitude;
    polar = alt > 0 ? 'day' : 'night';
  }
  const dayLengthMin = isValid(t.sunrise) && isValid(t.sunset) ? (t.sunset.getTime() - t.sunrise.getTime()) / 60000 : polar === 'day' ? 1440 : 0;
  return {
    ...t,
    blueHourMorning: [t.dawn, blueMorningEnd],
    blueHourEvening: [blueEveningStart, t.dusk],
    dayLengthMin,
    polar,
  };
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

export function moonInfo(date: Date, lat: number, lng: number): MoonInfo {
  const noon = new Date(date);
  noon.setHours(0, 0, 0, 0);
  const mt = SunCalc.getMoonTimes(noon, lat, lng);
  const ill = SunCalc.getMoonIllumination(date);
  return {
    rise: mt.rise && isValid(mt.rise) ? mt.rise : null,
    set: mt.set && isValid(mt.set) ? mt.set : null,
    alwaysUp: !!mt.alwaysUp,
    alwaysDown: !!mt.alwaysDown,
    phase: ill.phase,
    illumination: ill.fraction,
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
  return { lat: (φ2 * 180) / Math.PI, lng: ((((λ2 * 180) / Math.PI + 540) % 360) - 180) };
}
