import { Blueprint } from '@/components/Blueprint';
import { Button } from '@/components/Button';
import { Check, SelectField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { ENV_PRESETS, presetEnv } from '@/lib/light/environment';
import type { Environment } from '@/types/project';

/** Room or location around the set. Every control feeds the 3D view and the exposure readouts. */
export function EnvironmentPanel({ env, onChange }: { env: Environment; onChange: (e: Environment) => void }) {
  const set = (p: Partial<Environment>) => onChange({ ...env, ...p, preset: p.preset ?? 'custom' });
  const preset = ENV_PRESETS.find((p) => p.id === env.preset);
  return (
    <Blueprint title="Environment" index="E">
      <div className="stack stack--sm">
        <div className="env-presets" role="group" aria-label="Environment presets">
          {ENV_PRESETS.map((p) => (
            <Button key={p.id} size="sm" active={env.preset === p.id} onClick={() => onChange(presetEnv(p.id))}>
              {p.label}
            </Button>
          ))}
          <Button size="sm" active={env.preset === 'custom'} onClick={() => set({})}>Custom</Button>
        </div>
        <p className="tiny muted">{preset ? preset.note : 'Your own settings.'}</p>
        <Check label="Outdoors (no walls)" checked={env.outdoor} onChange={(v) => set({ outdoor: v })} />
        <div className="grid-2">
          <ColourField label={env.outdoor ? 'Ground' : 'Floor'} value={env.floorColour} onChange={(v) => set({ floorColour: v })} />
          {!env.outdoor && <ColourField label="Walls / background" value={env.wallColour} onChange={(v) => set({ wallColour: v })} />}
        </div>
        <Stepper label="Wall brightness (reflectance)" unit="%" value={Math.round(env.wallReflect * 100)} onChange={(v) => set({ wallReflect: v / 100 })} min={0} max={92} step={5} hint="White paint about 85%, grey about 40%, black drapes under 5%. Bright walls bounce your lights back as fill." />
        {!env.outdoor && (
          <>
            <SelectField label="Surface" value={env.material} onChange={(v) => set({ material: v as Environment['material'] })} options={[{ value: 'matte', label: 'Matte (paint, paper, fabric)' }, { value: 'satin', label: 'Satin' }, { value: 'gloss', label: 'Gloss (shows reflections)' }]} />
            <div className="grid-2">
              <Stepper label="Background behind subject" unit="m" value={env.wallDistance} onChange={(v) => set({ wallDistance: v })} min={0.3} max={20} step={0.1} decimals={1} />
              <Stepper label="Room width" unit="m" value={env.roomWidth} onChange={(v) => set({ roomWidth: v })} min={2} max={30} step={0.5} decimals={1} />
            </div>
            <Stepper label="Ceiling height" unit="m" value={env.ceilingHeight} onChange={(v) => set({ ceilingHeight: v })} min={2} max={12} step={0.1} decimals={1} />
          </>
        )}
        <div className="grid-2">
          <Stepper label="Light already there" unit="lux" value={env.ambientLux} onChange={(v) => set({ ambientLux: v })} min={0} max={100000} snaps={[0, 5, 20, 50, 100, 250, 500, 1000, 4000, 15000, 30000]} step={10} />
          <Stepper label="Its colour" unit="K" value={env.ambientKelvin} onChange={(v) => set({ ambientKelvin: v })} min={1800} max={12000} step={100} />
        </div>
        <Check label="Direct sun" checked={env.sun} onChange={(v) => set({ sun: v })} />
        {env.sun && (
          <div className="grid-2">
            <Stepper label="Sun direction" unit="°" value={env.sunAzimuth} onChange={(v) => set({ sunAzimuth: ((v % 360) + 360) % 360 })} step={15} hint="0° is the top of the plan." />
            <Stepper label="Sun height" unit="°" value={env.sunElevation} onChange={(v) => set({ sunElevation: v })} min={0} max={90} step={5} />
          </div>
        )}
      </div>
    </Blueprint>
  );
}

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      <span className="cluster">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 44, height: 44, border: '1px solid var(--hair-strong)', borderRadius: 4, padding: 2, background: 'var(--bg)' }} />
        <span className="mono tiny">{value.toUpperCase()}</span>
      </span>
    </label>
  );
}
