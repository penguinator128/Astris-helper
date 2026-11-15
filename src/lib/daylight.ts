import { dayTimes, moonInfo, tzOffsetMinutes, zonedDate, type DayTimes, type MoonInfo } from './sun';

export interface DaylightSummary {
  day: DayTimes;
  moon: MoonInfo;
  lines: string[];
}

/** Sun-based conditions summary for a shoot date, shared by the call sheet and the PDF. */
export function daylightSummary(isoDate: string, callTime: string, lat: number, lng: number, tz: string, fmt: (d: Date) => string): DaylightSummary {
  const noon = zonedDate(isoDate, '12:00', tz);
  const off = tzOffsetMinutes(noon, tz);
  const day = dayTimes(noon, lat, lng, off);
  const moon = moonInfo(noon, lat, lng, off);
  const call = zonedDate(isoDate, callTime || '07:00', tz);
  const lines: string[] = [];
  if (day.polar === 'day') lines.push('Sun stays up all day.');
  else if (day.polar === 'night') lines.push('Sun stays below the horizon all day.');
  else {
    const h = Math.floor(day.dayLengthMin / 60);
    const m = Math.round(day.dayLengthMin % 60);
    lines.push(`${h} h ${m} min of daylight, sunrise ${fmt(day.sunrise)} to sunset ${fmt(day.sunset)}.`);
    lines.push(`Golden hour from ${fmt(day.goldenHour)}; blue hour ${fmt(day.blueHourEvening[0])}–${fmt(day.blueHourEvening[1])}.`);
    const t = call.getTime();
    if (t < day.dawn.getTime()) lines.push(`Call is before civil dawn (${fmt(day.dawn)}): bring torches.`);
    else if (t < day.sunrise.getTime()) lines.push(`Call is in twilight; sunrise follows at ${fmt(day.sunrise)}.`);
    else if (t > day.sunset.getTime()) lines.push('Call is after sunset: night shoot.');
    else {
      const left = (day.sunset.getTime() - t) / 3600000;
      lines.push(`${left.toFixed(1)} h of daylight left after call.`);
    }
  }
  lines.push(`Moon ${Math.round(moon.illumination * 100)}% (${moon.phaseName.toLowerCase()}).`);
  return { day, moon, lines };
}

export function osmLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=16/${lat.toFixed(5)}/${lng.toFixed(5)}`;
}
