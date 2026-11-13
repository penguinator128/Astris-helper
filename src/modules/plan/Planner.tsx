import { lazy, Suspense, useMemo, useState } from 'react';
import { Crosshair, LocateFixed, MapPin, Save, Trash2, Clock } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { NumberField, TextField, Check } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Stepper } from '@/components/Stepper';
import { Sheet } from '@/components/Sheet';
import { EmptyState } from '@/components/EmptyState';
import { useSettings } from '@/store/settings';
import { useProject, useProjects } from '@/store/projects';
import { useUnits } from '@/lib/useUnits';
import { dayTimes, moonInfo, sunPosition, moonPosition, shadowLength, geoDistanceBearing, tzOffsetMinutes, zonedDate, type DayTimes } from '@/lib/sun';
import { compass, fmtDate, fmtDegrees, fmtNum, fmtTime, pad2, parseIsoDate, todayIso } from '@/lib/format';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import { SunDial } from './SunDial';
import type { SunPlan } from '@/types/project';
import './planner.css';

const PlanMap = lazy(() => import('./PlanMap'));

function minutesNow(tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return h * 60 + m;
}

function todayInZone(tz: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

function minutesOf(d: Date, tz: string): number | null {
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).formatToParts(d);
  return Number(parts.find((p) => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
}

export default function Planner() {
  const settings = useSettings();
  const tz = settings.timezone;
  const u = useUnits();
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);

  const [lat, setLat] = useState(settings.location.lat);
  const [lng, setLng] = useState(settings.location.lng);
  const [placeName, setPlaceName] = useState(settings.location.name);
  const [subject, setSubject] = useState<{ lat: number; lng: number } | null>(null);
  const [isoDate, setIsoDate] = useState(() => todayInZone(tz));
  const [minutes, setMinutes] = useState(() => minutesNow(tz));
  const [objectHeight, setObjectHeight] = useState(1.8);
  const [showMap, setShowMap] = useState(true);
  const [saving, setSaving] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planNote, setPlanNote] = useState('');

  const time = `${pad2(minutes / 60)}:${pad2(minutes % 60)}`;
  const instant = useMemo(() => zonedDate(isoDate, time, tz), [isoDate, time, tz]);
  const utcOffset = useMemo(() => tzOffsetMinutes(instant, tz), [instant, tz]);
  const validCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const day = useMemo(() => (validCoords ? dayTimes(instant, lat, lng, utcOffset) : null), [instant, lat, lng, utcOffset, validCoords]);
  const moon = useMemo(() => (validCoords ? moonInfo(instant, lat, lng, utcOffset) : null), [instant, lat, lng, utcOffset, validCoords]);
  const sun = useMemo(() => (validCoords ? sunPosition(instant, lat, lng) : { azimuth: 0, altitude: -90 }), [instant, lat, lng, validCoords]);
  const moonPos = useMemo(() => (validCoords ? moonPosition(instant, lat, lng) : { azimuth: 0, altitude: -90, distanceKm: 0 }), [instant, lat, lng, validCoords]);
  const sunriseAz = day && !Number.isNaN(day.sunrise.getTime()) ? sunPosition(day.sunrise, lat, lng).azimuth : null;
  const sunsetAz = day && !Number.isNaN(day.sunset.getTime()) ? sunPosition(day.sunset, lat, lng).azimuth : null;
  const shot = subject ? geoDistanceBearing(lat, lng, subject.lat, subject.lng) : null;
  const shadow = shadowLength(objectHeight, sun.altitude);

  const relation = (() => {
    if (!shot) return null;
    const diff = Math.abs((((sun.azimuth - shot.bearing) % 360) + 540) % 360 - 180); // 0 = sun behind camera, 180 = behind subject
    if (sun.altitude <= 0) return 'Sun is down';
    if (diff < 35) return 'Front-lit (sun behind camera)';
    if (diff < 70) return 'Front three-quarter';
    if (diff < 110) return 'Side-lit';
    if (diff < 145) return 'Back three-quarter';
    return 'Backlit (sun behind subject)';
  })();

  const t = (d: Date) => fmtTime(d, settings.timeFormat, tz);
  const online = typeof navigator !== 'undefined' ? navigator.onLine : true;

  function useGps() {
    if (!navigator.geolocation) return toast('Location is not available on this device');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Math.round(pos.coords.latitude * 1e5) / 1e5);
        setLng(Math.round(pos.coords.longitude * 1e5) / 1e5);
        setPlaceName('Current position');
      },
      () => toast('Could not read your location'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  function savePlan() {
    const plan: SunPlan = {
      id: uid(),
      name: planName.trim() || `${placeName || 'Plan'} ${isoDate} ${time}`,
      lat,
      lng,
      subjectLat: subject?.lat,
      subjectLng: subject?.lng,
      isoDate,
      time,
      note: planNote,
      createdAt: Date.now(),
    };
    patch((p) => ({ plans: [plan, ...p.plans] }));
    setSaving(false);
    setPlanName('');
    setPlanNote('');
    toast('Plan saved to project');
  }

  function loadPlan(p: SunPlan) {
    setLat(p.lat);
    setLng(p.lng);
    setPlaceName(p.name);
    setSubject(p.subjectLat != null && p.subjectLng != null ? { lat: p.subjectLat, lng: p.subjectLng } : null);
    setIsoDate(p.isoDate);
    const [h, m] = p.time.split(':').map(Number);
    setMinutes(h * 60 + m);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const dayPct = (d: Date) => {
    const m = minutesOf(d, tz);
    return m == null ? null : (m / 1440) * 100;
  };

  return (
    <main className="page">
      <PageHead
        index="01 · Planner"
        title="Sun and Moon Planner"
        sub={`${fmtDate(instant, tz, { weekday: 'long', day: 'numeric', month: 'long' })} · ${t(instant)} · ${tz}`}
        actions={
          <Button variant="primary" icon={<Save size={16} />} onClick={() => setSaving(true)}>
            Save plan
          </Button>
        }
      />

      <div className="tool tool--wide-results">
        <div className="tool__controls stack">
          <Blueprint title="Location" index="01">
            <div className="stack">
              <TextField label="Place" value={placeName} onChange={setPlaceName} placeholder="Location name" />
              <div className="grid-2">
                <NumberField label="Latitude" value={lat} onChange={setLat} step={0.0001} min={-90} max={90} />
                <NumberField label="Longitude" value={lng} onChange={setLng} step={0.0001} min={-180} max={180} />
              </div>
              <div className="cluster">
                <Button size="sm" variant="quiet" icon={<LocateFixed size={14} />} onClick={useGps}>
                  GPS
                </Button>
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<MapPin size={14} />}
                  onClick={() => {
                    setLat(settings.location.lat);
                    setLng(settings.location.lng);
                    setPlaceName(settings.location.name);
                  }}
                >
                  {settings.location.name}
                </Button>
                <Button
                  size="sm"
                  variant={subject ? 'default' : 'quiet'}
                  icon={<Crosshair size={14} />}
                  onClick={() => {
                    if (subject) setSubject(null);
                    else setSubject({ lat: lat + 0.0008, lng: lng + 0.0008 });
                  }}
                >
                  {subject ? 'Remove subject pin' : 'Add subject pin'}
                </Button>
              </div>
              <Check label="Show map (needs tiles online once; cached after)" checked={showMap} onChange={setShowMap} />
            </div>
          </Blueprint>

          <Blueprint title="Date and time" index="02">
            <div className="stack">
              <div className="grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="plan-date">
                    Date
                  </label>
                  <input id="plan-date" type="date" className="input input--mono" value={isoDate} onChange={(e) => e.target.value && setIsoDate(e.target.value)} />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="plan-time">
                    Time
                  </label>
                  <input
                    id="plan-time"
                    type="time"
                    className="input input--mono"
                    value={time}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number);
                      if (Number.isFinite(h)) setMinutes(h * 60 + (m || 0));
                    }}
                  />
                </div>
              </div>
              <div className="scrub">
                <label className="field__label" htmlFor="plan-scrub">
                  <span>Scrub the day</span>
                  <span className="mono">{t(instant)}</span>
                </label>
                <div style={{ position: 'relative' }}>
                  {day && (
                    <div className="scrub__track" aria-hidden="true">
                      {dayPct(day.sunrise) != null && dayPct(day.sunset) != null && (
                        <div className="scrub__day" style={{ left: `${dayPct(day.sunrise)}%`, width: `${dayPct(day.sunset)! - dayPct(day.sunrise)!}%` }} />
                      )}
                      {dayPct(day.sunrise) != null && dayPct(day.goldenHourEnd) != null && (
                        <div className="scrub__golden" style={{ left: `${dayPct(day.sunrise)}%`, width: `${Math.max(0, dayPct(day.goldenHourEnd)! - dayPct(day.sunrise)!)}%` }} />
                      )}
                      {dayPct(day.goldenHour) != null && dayPct(day.sunset) != null && (
                        <div className="scrub__golden" style={{ left: `${dayPct(day.goldenHour)}%`, width: `${Math.max(0, dayPct(day.sunset)! - dayPct(day.goldenHour)!)}%` }} />
                      )}
                    </div>
                  )}
                  <div className="slider">
                    <div className="slider__row">
                      <input
                        id="plan-scrub"
                        type="range"
                        min={0}
                        max={1439}
                        step={1}
                        value={minutes}
                        onChange={(e) => setMinutes(Number(e.target.value))}
                        style={{ ['--pct' as string]: `${(minutes / 1439) * 100}%` }}
                        aria-valuetext={t(instant)}
                      />
                    </div>
                  </div>
                </div>
                <div className="scrub__labels" aria-hidden="true">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>24:00</span>
                </div>
              </div>
              <div className="cluster">
                <Button
                  size="sm"
                  variant="quiet"
                  icon={<Clock size={14} />}
                  onClick={() => {
                    setIsoDate(todayInZone(tz));
                    setMinutes(minutesNow(tz));
                  }}
                >
                  Now
                </Button>
                {day && !Number.isNaN(day.goldenHour.getTime()) && (
                  <Button size="sm" variant="quiet" onClick={() => setMinutes(minutesOf(day.goldenHour, tz) ?? minutes)}>
                    Evening golden hour
                  </Button>
                )}
                {day && !Number.isNaN(day.sunrise.getTime()) && (
                  <Button size="sm" variant="quiet" onClick={() => setMinutes(minutesOf(day.sunrise, tz) ?? minutes)}>
                    Sunrise
                  </Button>
                )}
              </div>
            </div>
          </Blueprint>

          <Blueprint title="Shadow" index="03">
            <div className="stack">
              <Stepper label="Object height" unit={u.unit} value={u.toDisplay(objectHeight)} onChange={(v) => setObjectHeight(u.fromDisplay(v))} min={0.01} step={0.1} decimals={2} />
              <div className="readout-grid">
                <Readout label="Shadow length" value={sun.altitude > 0 ? u.fmt(shadow) : 'No sun'} size="sm" />
                <Readout label="Falls towards" value={sun.altitude > 0 ? `${compass((sun.azimuth + 180) % 360)} ${fmtDegrees((sun.azimuth + 180) % 360, 0)}` : '—'} size="sm" />
              </div>
            </div>
          </Blueprint>
        </div>

        <div className="tool__results stack">
          {showMap && (
            <div className="plan-map">
              {!online && <span className="plan-map__offline tag tag--wash">Offline: tiles show only if cached</span>}
              <Suspense fallback={<div className="muted small" style={{ padding: 16 }}>Loading map…</div>}>
                {validCoords && (
                  <PlanMap
                    camera={{ lat, lng }}
                    subject={subject}
                    sunAz={sun.azimuth}
                    sunUp={sun.altitude > 0}
                    moonAz={moonPos.azimuth}
                    moonUp={moonPos.altitude > 0}
                    sunriseAz={sunriseAz}
                    sunsetAz={sunsetAz}
                    onCameraMove={(a, b) => {
                      setLat(Math.round(a * 1e6) / 1e6);
                      setLng(Math.round(b * 1e6) / 1e6);
                    }}
                    onSubjectMove={(a, b) => setSubject({ lat: a, lng: b })}
                    onMapClick={(a, b) => {
                      if (subject) setSubject({ lat: a, lng: b });
                    }}
                  />
                )}
              </Suspense>
            </div>
          )}
          <div className="plan-legend" aria-hidden="true">
            <span className="sun">Sun</span>
            <span className="sun set">Sunrise / sunset</span>
            <span className="moon">Moon</span>
            <span className="shot">Camera to subject</span>
          </div>

          <Blueprint tone="yellow" aria-live="polite" aria-label="Sun and moon position">
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 'var(--s-4)', alignItems: 'center' }}>
              <SunDial sunAz={sun.azimuth} sunAlt={sun.altitude} moonAz={moonPos.azimuth} moonAlt={moonPos.altitude} shotBearing={shot?.bearing} sunriseAz={sunriseAz ?? undefined} sunsetAz={sunsetAz ?? undefined} />
              <div className="readout-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <Readout label="Sun azimuth" value={`${fmtDegrees(sun.azimuth, 0)} ${compass(sun.azimuth)}`} size="sm" />
                <Readout label="Sun elevation" value={fmtDegrees(sun.altitude, 1)} size="sm" />
                <Readout label="Moon azimuth" value={`${fmtDegrees(moonPos.azimuth, 0)} ${compass(moonPos.azimuth)}`} size="sm" />
                <Readout label="Moon elevation" value={fmtDegrees(moonPos.altitude, 1)} size="sm" />
                {moon && <Readout label="Moon" value={`${Math.round(moon.illumination * 100)}%`} size="sm" sub={moon.phaseName} />}
                {shot && <Readout label="Camera to subject" value={`${u.fmt(shot.distance, 0)} · ${compass(shot.bearing)}`} size="sm" sub={relation ?? undefined} />}
              </div>
            </div>
          </Blueprint>

          {day && <DayPanel day={day} moon={moon} t={t} tz={tz} minutes={minutes} />}

          <MonthCalendar isoDate={isoDate} lat={lat} lng={lng} tz={tz} t={t} onPick={setIsoDate} />

          <Blueprint title="Saved plans" index="05">
            {project.plans.length === 0 ? (
              <EmptyState title="No plans saved yet" body="Save a place, date and time to come back to it, and to include it in the Shoot Pack." action={<Button size="sm" onClick={() => setSaving(true)}>Save this plan</Button>} />
            ) : (
              <div className="rows">
                {project.plans.map((p) => (
                  <div key={p.id} className="row" style={{ gridTemplateColumns: '1fr auto' }}>
                    <button type="button" className="row__main" style={{ textAlign: 'left', minHeight: 44 }} onClick={() => loadPlan(p)}>
                      <span className="row__title">{p.name}</span>
                      <span className="row__sub mono tiny">
                        {fmtDate(parseIsoDate(p.isoDate))} {p.time} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                        {p.note ? ` · ${p.note}` : ''}
                      </span>
                    </button>
                    <span className="row__end">
                      <Button variant="ghost" size="sm" iconOnly icon={<Trash2 size={16} />} onClick={() => patch((pr) => ({ plans: pr.plans.filter((x) => x.id !== p.id) }))}>
                        Delete plan
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Blueprint>
        </div>
      </div>

      <Sheet
        open={saving}
        onClose={() => setSaving(false)}
        title="Save plan"
        footer={
          <Button variant="primary" block onClick={savePlan}>
            Save to {project.name}
          </Button>
        }
      >
        <div className="stack">
          <TextField label="Name" value={planName} onChange={setPlanName} placeholder={`${placeName || 'Plan'} ${isoDate} ${time}`} />
          <TextField label="Note" value={planNote} onChange={setPlanNote} placeholder="What this plan is for" />
          <p className="small muted">
            {lat.toFixed(4)}, {lng.toFixed(4)} · {fmtDate(instant, tz)} at {t(instant)}
            {subject ? ' · includes subject pin' : ''}
          </p>
        </div>
      </Sheet>
    </main>
  );
}

function DayPanel({ day, moon, t, tz, minutes }: { day: DayTimes; moon: ReturnType<typeof moonInfo> | null; t: (d: Date) => string; tz: string; minutes: number }) {
  const rows: { label: string; value: string; at?: Date }[] = [
    { label: 'Astronomical dawn', value: t(day.nightEnd), at: day.nightEnd },
    { label: 'Nautical dawn', value: t(day.nauticalDawn), at: day.nauticalDawn },
    { label: 'Civil dawn', value: t(day.dawn), at: day.dawn },
    { label: 'Blue hour (am)', value: `${t(day.blueHourMorning[0])}–${t(day.blueHourMorning[1])}` },
    { label: 'Sunrise', value: t(day.sunrise), at: day.sunrise },
    { label: 'Golden hour (am)', value: `${t(day.sunrise)}–${t(day.goldenHourEnd)}` },
    { label: 'Solar noon', value: t(day.solarNoon), at: day.solarNoon },
    { label: 'Golden hour (pm)', value: `${t(day.goldenHour)}–${t(day.sunset)}` },
    { label: 'Sunset', value: t(day.sunset), at: day.sunset },
    { label: 'Blue hour (pm)', value: `${t(day.blueHourEvening[0])}–${t(day.blueHourEvening[1])}` },
    { label: 'Civil dusk', value: t(day.dusk), at: day.dusk },
    { label: 'Nautical dusk', value: t(day.nauticalDusk), at: day.nauticalDusk },
    { label: 'Astronomical dusk', value: t(day.night), at: day.night },
    { label: 'Day length', value: day.polar === 'none' ? `${Math.floor(day.dayLengthMin / 60)}h ${pad2(day.dayLengthMin % 60)}m` : day.polar === 'day' ? 'Sun up all day' : 'Sun down all day' },
    { label: 'Moonrise', value: moon?.rise ? t(moon.rise) : moon?.alwaysUp ? 'Up all day' : '—', at: moon?.rise ?? undefined },
    { label: 'Moonset', value: moon?.set ? t(moon.set) : moon?.alwaysDown ? 'Down all day' : '—', at: moon?.set ?? undefined },
  ];
  // Highlight the next event after the scrubbed time
  const upcoming = rows.map((r) => (r.at ? minutesOf(r.at, tz) : null)).findIndex((m) => m != null && m >= minutes);
  return (
    <Blueprint title="Day" index="04">
      <div className="times-grid">
        {rows.map((r, i) => (
          <div key={r.label} className={`time-row ${i === upcoming ? 'time-row--hi' : ''}`}>
            <span className="time-row__label">{r.label}</span>
            <span className="time-row__value">{r.value}</span>
          </div>
        ))}
      </div>
    </Blueprint>
  );
}

function MonthCalendar({ isoDate, lat, lng, tz, t, onPick }: { isoDate: string; lat: number; lng: number; tz: string; t: (d: Date) => string; onPick: (iso: string) => void }) {
  const [y, m] = isoDate.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const rows = useMemo(() => {
    const out = [];
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${pad2(m)}-${pad2(d)}`;
      const noon = zonedDate(iso, '12:00', tz);
      const off = tzOffsetMinutes(noon, tz);
      const dt = dayTimes(noon, lat, lng, off);
      const mi = moonInfo(noon, lat, lng, off);
      out.push({ iso, d, dt, mi });
    }
    return out;
  }, [y, m, days, lat, lng, tz]);
  const monthName = new Intl.DateTimeFormat('en-AU', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return (
    <Blueprint title={`Month · ${monthName}`} index="06" padding="none">
      <div className="table-wrap" style={{ border: 0, maxHeight: 360, overflowY: 'auto' }}>
        <table className="table table--compact">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Sunrise</th>
              <th className="num">Golden pm</th>
              <th className="num">Sunset</th>
              <th className="num">Moonrise</th>
              <th className="num">Moonset</th>
              <th className="num">Moon</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.iso} className={r.iso === isoDate ? 'is-hi' : ''}>
                <td>
                  <button type="button" className="btn btn--ghost btn--sm" style={{ padding: 0, minHeight: 24 }} onClick={() => onPick(r.iso)}>
                    {new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric' }).format(new Date(y, m - 1, r.d))}
                  </button>
                </td>
                <td className="num">{t(r.dt.sunrise)}</td>
                <td className="num">{t(r.dt.goldenHour)}</td>
                <td className="num">{t(r.dt.sunset)}</td>
                <td className="num">{r.mi.rise ? t(r.mi.rise) : '—'}</td>
                <td className="num">{r.mi.set ? t(r.mi.set) : '—'}</td>
                <td className="num">{Math.round(r.mi.illumination * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted" style={{ padding: 'var(--s-2) var(--s-3)' }}>
        Times for {fmtNum(lat, 3)}, {fmtNum(lng, 3)} in {tz}. Today is {todayIso()}.
      </p>
    </Blueprint>
  );
}
