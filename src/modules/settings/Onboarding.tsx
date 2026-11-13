import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { useSettings } from '@/store/settings';
import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { NumberField, SelectField, TextField } from '@/components/Field';
import { Segmented } from '@/components/Segmented';
import { SENSORS, COMMON_APERTURES } from '@/lib/calc/sensors';
import { Stepper } from '@/components/Stepper';
import { Wordmark } from '@/brand/Wordmark';
import { useProjects } from '@/store/projects';

export default function Onboarding() {
  const s = useSettings();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const projects = useProjects();

  function finish() {
    s.update({ onboardingDone: true });
    // Apply the chosen default camera to the starter project too.
    const id = projects.currentId;
    if (id) {
      projects.patch(id, (p) => ({ camera: { ...p.camera, sensorId: s.defaultSensorId, focalLength: s.defaultFocalLength, aperture: s.defaultAperture } }));
    }
    nav('/', { replace: true });
  }

  const steps = ['Location', 'Camera', 'Theme'];

  return (
    <main className="page" style={{ maxWidth: 560 }}>
      <div className="stack stack--lg" style={{ paddingTop: 'var(--s-5)' }}>
        <div className="stack stack--sm">
          <Wordmark height={14} />
          <h1>Set up the kit</h1>
          <p className="muted small">Three quick defaults. You can change all of them later in Settings.</p>
        </div>

        <div className="cluster mono tiny" role="list" aria-label="Steps">
          {steps.map((label, i) => (
            <span key={label} role="listitem" className={`tag ${i === step ? 'tag--accent' : ''}`} aria-current={i === step ? 'step' : undefined}>
              {String(i + 1).padStart(2, '0')} {label}
            </span>
          ))}
        </div>

        {step === 0 && (
          <Blueprint title="Default location" index="01">
            <div className="stack">
              <p className="small muted">Used for sun and moon times on the home screen, the planner and call sheets.</p>
              <TextField label="Place name" value={s.location.name} onChange={(v) => s.update({ location: { ...s.location, name: v } })} />
              <div className="grid-2">
                <NumberField label="Latitude" value={s.location.lat} onChange={(v) => s.update({ location: { ...s.location, lat: v } })} step={0.0001} />
                <NumberField label="Longitude" value={s.location.lng} onChange={(v) => s.update({ location: { ...s.location, lng: v } })} step={0.0001} />
              </div>
            </div>
          </Blueprint>
        )}

        {step === 1 && (
          <Blueprint title="Default camera" index="02">
            <div className="stack">
              <SelectField label="Sensor" value={s.defaultSensorId} onChange={(v) => s.update({ defaultSensorId: v })} options={SENSORS.map((x) => ({ value: x.id, label: x.name }))} />
              <div className="grid-2">
                <Stepper label="Focal length" unit="mm" value={s.defaultFocalLength} onChange={(v) => s.update({ defaultFocalLength: v })} min={4} max={1200} />
                <Stepper label="Aperture" unit="f/" value={s.defaultAperture} onChange={(v) => s.update({ defaultAperture: v })} min={0.7} max={64} snaps={COMMON_APERTURES} decimals={1} />
              </div>
            </div>
          </Blueprint>
        )}

        {step === 2 && (
          <Blueprint title="Theme" index="03">
            <div className="stack">
              <p className="small muted">On-set dark keeps the screen dim between takes.</p>
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
          </Blueprint>
        )}

        <div className="cluster" style={{ justifyContent: 'space-between' }}>
          <Button variant="ghost" onClick={finish}>
            Skip
          </Button>
          <div className="cluster">
            {step > 0 && (
              <Button variant="quiet" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 2 ? (
              <Button variant="primary" icon={<ArrowRight size={16} />} onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button variant="primary" onClick={finish}>
                Start
              </Button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
