import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ExternalLink, LocateFixed, MapPin, Plus, Trash2, FileDown } from 'lucide-react';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { NumberField, TextAreaField, TextField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { useProject, useProjects } from '@/store/projects';
import { useSettings } from '@/store/settings';
import { uid } from '@/lib/id';
import { toast } from '@/store/toast';
import { fmtDate, fmtTime, parseIsoDate } from '@/lib/format';
import { daylightSummary, osmLink } from '@/lib/daylight';
import type { CallSheet as CallSheetT, CallSheetPerson, CallSheetScheduleItem } from '@/types/project';

export default function CallSheet() {
  const project = useProject();
  const patch = useProjects((s) => s.patchCurrent);
  const settings = useSettings();
  const cs = project.callSheet;
  const set = (d: Partial<CallSheetT>) => patch((p) => ({ callSheet: { ...p.callSheet, ...d } }));
  const lat = cs.lat ?? settings.location.lat;
  const lng = cs.lng ?? settings.location.lng;
  const fmt = (d: Date) => fmtTime(d, settings.timeFormat, settings.timezone);
  const summary = useMemo(() => daylightSummary(cs.isoDate, cs.callTime, lat, lng, settings.timezone, (d) => fmtTime(d, settings.timeFormat, settings.timezone)), [cs.isoDate, cs.callTime, lat, lng, settings.timezone, settings.timeFormat]);
  const [locating, setLocating] = useState(false);

  function setPerson(id: string, d: Partial<CallSheetPerson>) {
    set({ people: cs.people.map((p) => (p.id === id ? { ...p, ...d } : p)) });
  }
  function setItem(id: string, d: Partial<CallSheetScheduleItem>) {
    set({ schedule: cs.schedule.map((s) => (s.id === id ? { ...s, ...d } : s)) });
  }
  function gps() {
    if (!navigator.geolocation) return toast('Location is not available on this device');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set({ lat: Math.round(pos.coords.latitude * 1e5) / 1e5, lng: Math.round(pos.coords.longitude * 1e5) / 1e5 });
        setLocating(false);
      },
      () => {
        toast('Could not read your location');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }
  function addFromShots() {
    const shots = project.shots.slice().sort((a, b) => a.order - b.order);
    if (shots.length === 0) return toast('No shots in the shot list yet');
    const scenes = Array.from(new Set(shots.map((s) => s.scene)));
    const items = scenes.map((sc) => {
      const inScene = shots.filter((s) => s.scene === sc);
      return { id: uid(), time: '', item: `Scene ${sc}: ${inScene.length} shot${inScene.length === 1 ? '' : 's'}`, notes: inScene.map((s) => `${s.scene}${s.shotNumber}`).join(', ') };
    });
    set({ schedule: [...cs.schedule, ...items] });
    toast(`Added ${items.length} scene${items.length === 1 ? '' : 's'} from the shot list`);
  }

  const sortedSchedule = cs.schedule.slice().sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

  return (
    <main className="page">
      <PageHead
        index="10 · Call"
        title="Call Sheet"
        sub={`${project.name} · ${fmtDate(parseIsoDate(cs.isoDate), undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <Link to="/export" className="btn btn--sm btn--quiet">
            <FileDown size={14} /> PDF
          </Link>
        }
      />
      <div className="tool">
        <div className="stack">
          <Blueprint title="When" index="01">
            <div className="grid-2">
              <div className="field">
                <label className="field__label" htmlFor="cs-date">
                  Shoot date
                </label>
                <input id="cs-date" type="date" className="input input--mono" value={cs.isoDate} onChange={(e) => e.target.value && set({ isoDate: e.target.value })} />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="cs-call">
                  General call
                </label>
                <input id="cs-call" type="time" className="input input--mono" value={cs.callTime} onChange={(e) => set({ callTime: e.target.value })} />
              </div>
            </div>
          </Blueprint>

          <Blueprint title="Where" index="02">
            <div className="stack">
              <TextField label="Location name" value={cs.locationName} onChange={(v) => set({ locationName: v })} placeholder="e.g. Lake Burley Griffin, west basin" />
              <TextField label="Address" value={cs.locationAddress} onChange={(v) => set({ locationAddress: v })} />
              <div className="grid-2">
                <NumberField label="Latitude" value={lat} onChange={(v) => set({ lat: v })} step={0.0001} />
                <NumberField label="Longitude" value={lng} onChange={(v) => set({ lng: v })} step={0.0001} />
              </div>
              <div className="cluster">
                <Button size="sm" variant="quiet" icon={<LocateFixed size={14} />} onClick={gps} disabled={locating}>
                  {locating ? 'Locating…' : 'GPS'}
                </Button>
                <Button size="sm" variant="quiet" icon={<MapPin size={14} />} onClick={() => set({ lat: undefined, lng: undefined })}>
                  Use {settings.location.name}
                </Button>
                <a className="btn btn--sm btn--ghost" href={osmLink(lat, lng)} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Open map
                </a>
              </div>
              <TextAreaField label="Parking and access" value={cs.parking} onChange={(v) => set({ parking: v })} rows={2} placeholder="Where to park, gate codes, nearest toilets" />
            </div>
          </Blueprint>

          <Blueprint
            title="Cast and crew"
            index="03"
            aside={
              <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => set({ people: [...cs.people, { id: uid(), name: '', role: '', callTime: cs.callTime, contact: '' }] })}>
                Person
              </Button>
            }
          >
            {cs.people.length === 0 ? (
              <p className="small muted">Solo shoot? Add yourself so the PDF has a contact, or leave it empty.</p>
            ) : (
              <div className="stack stack--sm">
                {cs.people.map((p) => (
                  <div key={p.id} className="stack stack--sm" style={{ paddingBottom: 'var(--s-3)', borderBottom: '1px solid var(--hair)' }}>
                    <div className="grid-2">
                      <TextField label="Name" value={p.name} onChange={(v) => setPerson(p.id, { name: v })} />
                      <TextField label="Role" value={p.role} onChange={(v) => setPerson(p.id, { role: v })} placeholder="Director, DP, talent" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto', gap: 'var(--s-2)', alignItems: 'end' }}>
                      <div className="field">
                        <label className="field__label" htmlFor={`call-${p.id}`}>
                          Call
                        </label>
                        <input id={`call-${p.id}`} type="time" className="input input--mono" value={p.callTime} onChange={(e) => setPerson(p.id, { callTime: e.target.value })} />
                      </div>
                      <TextField label="Contact" value={p.contact} onChange={(v) => setPerson(p.id, { contact: v })} placeholder="Phone or email" inputMode="tel" />
                      <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => set({ people: cs.people.filter((x) => x.id !== p.id) })}>
                        Remove {p.name || 'person'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Blueprint>
        </div>

        <div className="stack">
          <Blueprint tone="yellow" aria-live="polite" aria-label="Sun times for the shoot">
            <div className="stack">
              <div className="readout-grid">
                <Readout label="Call" value={cs.callTime || '—'} size="sm" />
                <Readout label="Sunrise" value={fmt(summary.day.sunrise)} size="sm" />
                <Readout label="Golden hour" value={fmt(summary.day.goldenHour)} size="sm" />
                <Readout label="Sunset" value={fmt(summary.day.sunset)} size="sm" />
              </div>
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {summary.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
          </Blueprint>

          <Blueprint title="Weather" index="04">
            <TextAreaField label="Forecast and conditions" value={cs.weatherNote} onChange={(v) => set({ weatherNote: v })} rows={2} placeholder="Check the BoM forecast the night before: temperature, wind, rain chance" hint="The app works offline, so it does not fetch forecasts. Sun and moon times above are calculated on the device." />
          </Blueprint>

          <Blueprint
            title="Schedule"
            index="05"
            aside={
              <div className="cluster">
                <Button size="sm" variant="ghost" onClick={addFromShots}>
                  From shot list
                </Button>
                <Button size="sm" variant="quiet" icon={<Plus size={14} />} onClick={() => set({ schedule: [...cs.schedule, { id: uid(), time: '', item: '', notes: '' }] })}>
                  Item
                </Button>
              </div>
            }
          >
            {cs.schedule.length === 0 ? (
              <p className="small muted">Add the day’s blocks: arrival, setup, scenes, meal, wrap. Items sort by time.</p>
            ) : (
              <div className="stack stack--sm">
                {sortedSchedule.map((s) => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '108px 1fr auto', gap: 'var(--s-2)', alignItems: 'start', paddingBottom: 'var(--s-2)', borderBottom: '1px solid var(--hair)' }}>
                    <div className="field">
                      <label className="field__label" htmlFor={`t-${s.id}`}>
                        Time
                      </label>
                      <input id={`t-${s.id}`} type="time" className="input input--mono" value={s.time} onChange={(e) => setItem(s.id, { time: e.target.value })} />
                    </div>
                    <div className="stack stack--sm">
                      <TextField label="Item" value={s.item} onChange={(v) => setItem(s.id, { item: v })} />
                      <TextField label="Notes" value={s.notes} onChange={(v) => setItem(s.id, { notes: v })} />
                    </div>
                    <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={14} />} onClick={() => set({ schedule: cs.schedule.filter((x) => x.id !== s.id) })} style={{ marginTop: 22 }}>
                      Remove item
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Blueprint>

          <Blueprint title="Notes" index="06">
            <TextAreaField label="General notes" value={cs.notes} onChange={(v) => set({ notes: v })} rows={4} placeholder="Safety, wardrobe, props, permits, emergency contact, nearest hospital" />
          </Blueprint>
        </div>
      </div>
    </main>
  );
}
