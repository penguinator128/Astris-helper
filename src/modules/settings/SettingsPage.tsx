import { useState } from 'react';
import { Link } from 'react-router';
import { PageHead } from '@/components/PageHead';
import { Blueprint } from '@/components/Blueprint';
import { Segmented } from '@/components/Segmented';
import { NumberField, SelectField, TextField } from '@/components/Field';
import { Button } from '@/components/Button';
import { Confirm } from '@/components/Sheet';
import { useSettings } from '@/store/settings';
import { SENSORS, COMMON_APERTURES } from '@/lib/calc/sensors';
import { dbClearAll } from '@/store/db';
import { Stepper } from '@/components/Stepper';
import { Wordmark } from '@/brand/Wordmark';
import { toast } from '@/store/toast';

export default function SettingsPage() {
  const s = useSettings();
  const [clearing, setClearing] = useState(false);

  return (
    <main className="page">
      <PageHead title="Settings" sub="Preferences apply across every project on this device." />
      <div className="stack stack--lg">
        <Blueprint title="Display" index="A">
          <div className="stack">
            <div className="field">
              <span className="field__label">Theme</span>
              <Segmented
                value={s.theme}
                onChange={(v) => s.update({ theme: v })}
                options={[
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'On-set dark' },
                ]}
                block
                label="Theme"
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <span className="field__label">Units</span>
                <Segmented
                  value={s.units}
                  onChange={(v) => s.update({ units: v })}
                  options={[
                    { value: 'metric', label: 'Metric' },
                    { value: 'imperial', label: 'Imperial' },
                  ]}
                  block
                  label="Units"
                />
              </div>
              <div className="field">
                <span className="field__label">Time</span>
                <Segmented
                  value={s.timeFormat}
                  onChange={(v) => s.update({ timeFormat: v })}
                  options={[
                    { value: '24h', label: '24-hour' },
                    { value: '12h', label: '12-hour' },
                  ]}
                  block
                  label="Time format"
                />
              </div>
            </div>
          </div>
        </Blueprint>

        <Blueprint title="Default camera" index="B">
          <div className="stack">
            <SelectField
              label="Sensor"
              value={s.defaultSensorId}
              onChange={(v) => s.update({ defaultSensorId: v })}
              options={SENSORS.map((x) => ({ value: x.id, label: x.name }))}
            />
            <div className="grid-2">
              <Stepper label="Focal length" unit="mm" value={s.defaultFocalLength} onChange={(v) => s.update({ defaultFocalLength: v })} min={4} max={1200} />
              <Stepper label="Aperture" unit="f/" value={s.defaultAperture} onChange={(v) => s.update({ defaultAperture: v })} min={0.7} max={64} snaps={COMMON_APERTURES} decimals={1} />
            </div>
            <p className="tiny muted">New projects start with this camera. Each project remembers its own last-used lens and aperture.</p>
          </div>
        </Blueprint>

        <Blueprint title="Default location" index="C">
          <div className="stack">
            <TextField label="Place name" value={s.location.name} onChange={(v) => s.update({ location: { ...s.location, name: v } })} />
            <div className="grid-2">
              <NumberField label="Latitude" value={s.location.lat} onChange={(v) => s.update({ location: { ...s.location, lat: v } })} step={0.0001} min={-90} max={90} />
              <NumberField label="Longitude" value={s.location.lng} onChange={(v) => s.update({ location: { ...s.location, lng: v } })} step={0.0001} min={-180} max={180} />
            </div>
            <TextField label="Time zone" value={s.timezone} onChange={(v) => s.update({ timezone: v })} hint="IANA zone name, for example Australia/Sydney." mono />
            <Button
              variant="quiet"
              onClick={() => {
                if (!navigator.geolocation) return toast('Location is not available on this device');
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    s.update({ location: { ...s.location, lat: Math.round(pos.coords.latitude * 1e4) / 1e4, lng: Math.round(pos.coords.longitude * 1e4) / 1e4 } });
                    toast('Location updated from GPS');
                  },
                  () => toast('Could not read your location'),
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              }}
            >
              Use current GPS position
            </Button>
          </div>
        </Blueprint>

        <Blueprint title="Data" index="D">
          <div className="stack">
            <p className="small muted">Everything lives in this browser’s storage. Back up with a JSON export from the Shoot Pack screen, and import it on another device.</p>
            <div className="cluster">
              <Link to="/export" className="btn">
                Export and import
              </Link>
              <Button variant="danger" onClick={() => setClearing(true)}>
                Clear all data
              </Button>
            </div>
          </div>
        </Blueprint>

        <Blueprint title="About" index="E">
          <div className="stack stack--sm">
            <Wordmark height={14} />
            <p className="small muted">Astris Field Kit, version {__APP_VERSION__}. A pocket film-production helper for pre-production and on set. Built in Canberra. All data stays on your device.</p>
            <p className="tiny muted">Sun and moon maths by SunCalc. Map tiles by OpenStreetMap contributors. Fonts: Inter Tight and IBM Plex Mono.</p>
          </div>
        </Blueprint>
      </div>

      <Confirm
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={async () => {
          await dbClearAll();
          try {
            localStorage.clear();
          } catch {
            /* ignore */
          }
          window.location.href = '/';
        }}
        title="Clear all data on this device?"
        body="Every project, image, palette and setting will be removed. Export a backup first if you might want any of it back."
        confirmLabel="Clear everything"
        danger
      />
    </main>
  );
}
