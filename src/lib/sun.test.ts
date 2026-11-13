import { describe, expect, it } from 'vitest';
import { dayTimes, geoDestination, geoDistanceBearing, moonInfo, shadowLength, sunPosition, tzOffsetMinutes, zonedDate } from './sun';

const CBR = { lat: -35.2809, lng: 149.13 };

describe('sun helpers', () => {
  it('knows the Sydney zone offset with and without daylight saving', () => {
    expect(tzOffsetMinutes(new Date(Date.UTC(2026, 0, 15)), 'Australia/Sydney')).toBe(660);
    expect(tzOffsetMinutes(new Date(Date.UTC(2026, 6, 15)), 'Australia/Sydney')).toBe(600);
  });
  it('builds zoned dates', () => {
    const d = zonedDate('2026-01-15', '09:30', 'Australia/Sydney');
    expect(d.toISOString()).toBe('2026-01-14T22:30:00.000Z');
    expect(zonedDate('2026-07-15', '09:30', 'Australia/Sydney').toISOString()).toBe('2026-07-14T23:30:00.000Z');
  });
  it('Canberra sunrise on 1 Jan 2026 is about 05:50 AEDT', () => {
    const t = dayTimes(zonedDate('2026-01-01', '12:00', 'Australia/Sydney'), CBR.lat, CBR.lng, 660);
    // Published almanac values: sunrise 05:50, sunset 20:19 AEDT. Allow a couple of minutes for refraction models.
    const minutesLocal = (d: Date) => {
      const p = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
      return Number(p.find((x) => x.type === 'hour')?.value) * 60 + Number(p.find((x) => x.type === 'minute')?.value);
    };
    expect(Math.abs(minutesLocal(t.sunrise) - (5 * 60 + 50))).toBeLessThanOrEqual(3);
    expect(Math.abs(minutesLocal(t.sunset) - (20 * 60 + 19))).toBeLessThanOrEqual(3);
  });
  it('in Canberra the midsummer sun is high and to the north at solar noon', () => {
    const t = dayTimes(zonedDate('2026-01-01', '12:00', 'Australia/Sydney'), CBR.lat, CBR.lng, 660);
    const p = sunPosition(t.solarNoon, CBR.lat, CBR.lng);
    expect(p.altitude).toBeGreaterThan(70);
    expect(Math.min(p.azimuth, 360 - p.azimuth)).toBeLessThan(5);
    expect(t.dayLengthMin).toBeGreaterThan(850);
    expect(t.sunrise.getTime()).toBeLessThan(t.goldenHourEnd.getTime());
    expect(t.goldenHour.getTime()).toBeLessThan(t.sunset.getTime());
    expect(t.polar).toBe('none');
  });
  it('winter days are shorter', () => {
    const t = dayTimes(zonedDate('2026-06-21', '12:00', 'Australia/Sydney'), CBR.lat, CBR.lng, 600);
    expect(t.dayLengthMin).toBeLessThan(600);
  });
  it('moon info reports a phase name and illumination', () => {
    const m = moonInfo(zonedDate('2026-01-03', '12:00', 'Australia/Sydney'), CBR.lat, CBR.lng, 660);
    expect(m.illumination).toBeGreaterThan(0.9); // full moon 3 Jan 2026
    expect(m.phaseName).toBe('Full moon');
  });
  it('shadow length', () => {
    expect(shadowLength(1, 45)).toBeCloseTo(1, 6);
    expect(shadowLength(1.8, 30)).toBeCloseTo(3.118, 2);
    expect(shadowLength(1, 0)).toBe(Infinity);
  });
  it('great-circle distance Canberra to Sydney ~247 km, bearing north-east', () => {
    const r = geoDistanceBearing(CBR.lat, CBR.lng, -33.8688, 151.2093);
    expect(r.distance / 1000).toBeGreaterThan(240);
    expect(r.distance / 1000).toBeLessThan(255);
    expect(r.bearing).toBeGreaterThan(40);
    expect(r.bearing).toBeLessThan(60);
    const back = geoDestination(CBR.lat, CBR.lng, r.bearing, r.distance);
    expect(back.lat).toBeCloseTo(-33.8688, 3);
    expect(back.lng).toBeCloseTo(151.2093, 3);
  });
});
