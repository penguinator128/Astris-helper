import { useState } from 'react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Check, SelectField, TextField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { SENSORS } from '@/lib/calc/sensors';
import { PROFILES } from '@/lib/camera/profiles';
import { MOUNTS, LENS_FORMATS } from '@/lib/camera/mounts';
import { BODY_TYPES, CODECS, PORT_OPTIONS, RESOLUTIONS, describeBody, describeLens, startingInput, startingLens, type BodyInput, type BodyType, type LensInput } from '@/lib/camera/custom';
import type { CameraBodySpec, LensFormat, LensSpec } from '@/types/project';

const OTHER = '__other';

/** Mount picker: the common mounts, or type your own. */
function MountField({ value, onChange, label = 'Lens mount' }: { value: string; onChange: (v: string) => void; label?: string }) {
  const known = MOUNTS.some((m) => m.id === value);
  const [other, setOther] = useState(!known && !!value);
  return (
    <div className="stack stack--sm">
      <SelectField
        label={label}
        value={other ? OTHER : value}
        onChange={(v) => {
          if (v === OTHER) {
            setOther(true);
            onChange('');
          } else {
            setOther(false);
            onChange(v);
          }
        }}
        options={[...MOUNTS.map((m) => ({ value: m.id, label: m.name })), { value: OTHER, label: 'Another mount (type it)' }]}
      />
      {other && <TextField label="Mount name" value={value} onChange={onChange} placeholder="e.g. Canon FD" />}
    </div>
  );
}

/** Describe any camera. Starting values follow the type you pick; change anything. */
export function CameraForm({ open, onClose, onSave, initial, title = 'Describe your camera' }: { open: boolean; onClose: () => void; onSave: (b: CameraBodySpec) => void; initial?: { input: BodyInput; id?: string }; title?: string }) {
  const [f, setF] = useState<BodyInput>(() => initial?.input ?? startingInput('mirrorless'));
  const set = (p: Partial<BodyInput>) => setF((x) => ({ ...x, ...p }));
  const toggle = (key: 'codecs' | 'profiles', id: string, on: boolean) => setF((x) => ({ ...x, [key]: on ? [...x[key], id] : x[key].filter((k) => k !== id) }));
  const valid = f.model.trim().length > 0 || f.manufacturer.trim().length > 0;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      wide
      footer={
        <Button variant="primary" block disabled={!valid} onClick={() => onSave(describeBody(f, initial?.id))}>
          {initial?.id ? 'Save camera details' : 'Add this camera'}
        </Button>
      }
    >
      <div className="stack">
        <p className="tiny muted">Fill in what you know; the rest has sensible starting values for the type. Your camera's spec sheet or manual has everything here.</p>
        <SelectField
          label="Type"
          value={f.type}
          onChange={(v) => setF((x) => ({ ...startingInput(v as BodyType), manufacturer: x.manufacturer, model: x.model }))}
          options={BODY_TYPES.map((t) => ({ value: t.id, label: t.label }))}
          hint="Changing the type resets the other values to typical ones for that type."
        />
        <div className="grid-2">
          <TextField label="Make" value={f.manufacturer} onChange={(v) => set({ manufacturer: v })} placeholder="e.g. Canon" />
          <TextField label="Model" value={f.model} onChange={(v) => set({ model: v })} placeholder="e.g. EOS R50 V" />
        </div>
        <MountField value={f.mount} onChange={(v) => set({ mount: v })} />
        <SelectField label="Sensor" value={f.sensorId} onChange={(v) => { const s = SENSORS.find((x) => x.id === v); set({ sensorId: v, ...(s ? { sensorW: s.width, sensorH: s.height } : {}) }); }} options={[...SENSORS.map((s) => ({ value: s.id, label: `${s.name} · ${s.width} × ${s.height} mm` })), { value: 'custom', label: 'Another size (type it)' }]} />
        {f.sensorId === 'custom' && (
          <div className="grid-2">
            <Stepper label="Sensor width" unit="mm" value={f.sensorW} onChange={(v) => set({ sensorW: v })} min={2} max={60} step={0.1} decimals={1} />
            <Stepper label="Sensor height" unit="mm" value={f.sensorH} onChange={(v) => set({ sensorH: v })} min={2} max={50} step={0.1} decimals={1} />
          </div>
        )}
        <div className="grid-2">
          <Stepper label="Lowest ISO" value={f.isoMin} onChange={(v) => set({ isoMin: v })} min={25} max={6400} step={25} />
          <Stepper label="Highest ISO" value={f.isoMax} onChange={(v) => set({ isoMax: v })} min={800} max={409600} step={100} />
        </div>
        <TextField label="Native ISO (one or two)" value={f.nativeIso} onChange={(v) => set({ nativeIso: v })} placeholder="e.g. 800, 12800" hint="The cleanest ISO. Cameras with dual native ISO have two." />
        <Check label="Uses Exposure Index (EI) instead of ISO" checked={f.usesEI} onChange={(v) => set({ usesEI: v })} />
        <SelectField label="Highest resolution" value={f.topRes} onChange={(v) => set({ topRes: v })} options={RESOLUTIONS.map((r) => ({ value: r, label: r }))} />
        <div className="grid-2">
          <Stepper label="Top frame rate at that size" unit="fps" value={f.topFps} onChange={(v) => set({ topFps: v })} min={24} max={240} step={1} />
          <Stepper label="Top frame rate in HD" unit="fps" value={f.hdFps} onChange={(v) => set({ hdFps: v })} min={24} max={240} step={1} />
        </div>
        <fieldset className="check-group">
          <legend className="field__label">Codecs it records</legend>
          {CODECS.map((c) => (
            <Check key={c.id} label={`${c.codec.name} · ${c.codec.bitDepths.join('/')} ${c.codec.chroma.join('/')}`} checked={f.codecs.includes(c.id)} onChange={(v) => toggle('codecs', c.id, v)} />
          ))}
        </fieldset>
        <fieldset className="check-group">
          <legend className="field__label">Picture profiles</legend>
          <p className="tiny muted">Tick your maker's Log if it is listed; otherwise "Log (any maker)" previews a typical Log look.</p>
          {PROFILES.map((p) => (
            <Check key={p.id} label={p.name} checked={f.profiles.includes(p.id)} onChange={(v) => toggle('profiles', p.id, v)} />
          ))}
        </fieldset>
        <Check label="In-body stabilisation (IBIS)" checked={f.ibis} onChange={(v) => set({ ibis: v })} />
        <div className="grid-2">
          <TextField label="Battery type" value={f.battery} onChange={(v) => set({ battery: v })} placeholder="e.g. LP-E17, NP-F, V-mount" />
          <div className="grid-2">
            <Stepper label="Min volts" unit="V" value={f.voltsMin} onChange={(v) => set({ voltsMin: v })} min={3} max={34} step={0.1} decimals={1} />
            <Stepper label="Max volts" unit="V" value={f.voltsMax} onChange={(v) => set({ voltsMax: v })} min={3} max={34} step={0.1} decimals={1} />
          </div>
        </div>
        <fieldset className="check-group">
          <legend className="field__label">Inputs and outputs</legend>
          {PORT_OPTIONS.map((o) =>
            o.count ? (
              <Stepper key={o.id} label={o.label} value={f.ports[o.id] ?? 0} onChange={(v) => set({ ports: { ...f.ports, [o.id]: v } })} min={0} max={4} step={1} />
            ) : (
              <Check key={o.id} label={o.label} checked={!!f.ports[o.id]} onChange={(v) => set({ ports: { ...f.ports, [o.id]: v ? 1 : 0 } })} />
            ),
          )}
        </fieldset>
        <div className="grid-3">
          <Stepper label="Width" unit="mm" value={f.size[0]} onChange={(v) => set({ size: [v, f.size[1], f.size[2]] })} min={20} max={400} step={1} />
          <Stepper label="Height" unit="mm" value={f.size[1]} onChange={(v) => set({ size: [f.size[0], v, f.size[2]] })} min={20} max={400} step={1} />
          <Stepper label="Depth" unit="mm" value={f.size[2]} onChange={(v) => set({ size: [f.size[0], f.size[1], v] })} min={5} max={500} step={1} />
        </div>
        <Stepper label="Weight (body only)" unit="kg" value={f.weightKg} onChange={(v) => set({ weightKg: v })} min={0.05} max={20} step={0.05} decimals={2} />
      </div>
    </Sheet>
  );
}

/** Describe any lens. */
export function LensForm({ open, onClose, onSave, mount, initial }: { open: boolean; onClose: () => void; onSave: (l: LensSpec) => void; mount: string; initial?: LensSpec }) {
  const [f, setF] = useState<LensInput>(() => (initial ? { ...startingLens(initial.mount), ...initial, prime: initial.focalMin === initial.focalMax } : startingLens(mount)));
  const set = (p: Partial<LensInput>) => setF((x) => ({ ...x, ...p }));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={initial ? 'Lens details' : 'Describe your lens'}
      wide
      footer={
        <Button variant="primary" block onClick={() => onSave(describeLens(f))}>
          {initial ? 'Save lens details' : 'Add and attach this lens'}
        </Button>
      }
    >
      <div className="stack">
        <div className="grid-2">
          <TextField label="Make" value={f.manufacturer} onChange={(v) => set({ manufacturer: v })} placeholder="e.g. Sigma" />
          <TextField label="Model" value={f.model} onChange={(v) => set({ model: v })} placeholder="e.g. 18-35mm f/1.8 DC HSM Art" hint="Leave blank and it is named from the focal length and aperture." />
        </div>
        <MountField value={f.mount} onChange={(v) => set({ mount: v })} />
        <Check label="Prime (one focal length)" checked={f.prime} onChange={(v) => set({ prime: v, focalMax: v ? f.focalMin : Math.max(f.focalMax, f.focalMin + 10) })} />
        <div className="grid-2">
          <Stepper label={f.prime ? 'Focal length' : 'Widest focal length'} unit="mm" value={f.focalMin} onChange={(v) => set({ focalMin: v, ...(f.prime ? { focalMax: v } : {}) })} min={4} max={1200} step={1} />
          {!f.prime && <Stepper label="Longest focal length" unit="mm" value={f.focalMax} onChange={(v) => set({ focalMax: v })} min={5} max={1200} step={1} />}
        </div>
        <div className="grid-2">
          <Stepper label={f.prime ? 'Widest aperture' : 'Widest aperture (wide end)'} unit="f/" value={f.maxAperture} onChange={(v) => set({ maxAperture: v, ...(f.prime ? { maxApertureTele: v } : {}) })} min={0.7} max={11} step={0.1} decimals={1} />
          {!f.prime && <Stepper label="Widest aperture (long end)" unit="f/" value={f.maxApertureTele} onChange={(v) => set({ maxApertureTele: v })} min={0.7} max={16} step={0.1} decimals={1} hint="Same as the wide end for a constant-aperture zoom." />}
        </div>
        <div className="grid-2">
          <Stepper label="Smallest aperture" unit="f/" value={f.minAperture} onChange={(v) => set({ minAperture: v })} min={8} max={64} step={1} />
          <Stepper label="Close focus" unit="m" value={f.minFocus} onChange={(v) => set({ minFocus: v })} min={0.01} max={10} step={0.01} decimals={2} />
        </div>
        <div className="grid-2">
          <Stepper label="Filter thread" unit="mm" value={f.filterThread} onChange={(v) => set({ filterThread: v })} min={0} max={150} step={1} hint="0 if it has none." />
          <SelectField label="Made for" value={f.format ?? 'full-frame'} onChange={(v) => set({ format: v as LensFormat })} options={LENS_FORMATS.map((x) => ({ value: x.id, label: x.label }))} hint="A lens made for a smaller sensor vignettes on a bigger one." />
        </div>
        <div className="grid-3">
          <Stepper label="Length" unit="mm" value={f.length ?? 80} onChange={(v) => set({ length: v })} min={10} max={600} step={1} />
          <Stepper label="Diameter" unit="mm" value={f.diameter ?? 70} onChange={(v) => set({ diameter: v })} min={20} max={200} step={1} />
          <Stepper label="Weight" unit="kg" value={f.weightKg ?? 0.3} onChange={(v) => set({ weightKg: v })} min={0.02} max={10} step={0.01} decimals={2} />
        </div>
      </div>
    </Sheet>
  );
}
