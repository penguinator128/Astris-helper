import { useState } from 'react';
import { Link } from 'react-router';
import { Blueprint } from '@/components/Blueprint';
import { Tabs } from '@/components/Tabs';
import { Stepper } from '@/components/Stepper';
import { NumberField, Check } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { CameraPicker } from '../shared/CameraPicker';
import { useCamera } from '../shared/useCamera';
import { useUnits } from '@/lib/useUnits';
import { depthOfField, apertureForDof, distanceForDof } from '@/lib/calc/optics';
import { fmtAperture, fmtNum } from '@/lib/format';
import { Segmented } from '@/components/Segmented';

export default function DofCalc() {
  const [tab, setTab] = useState<'classic' | 'inverse'>('classic');
  const { camera, sensor, coc: autoCoc } = useCamera();
  const u = useUnits();
  const [distance, setDistance] = useState(3);
  const [customCoc, setCustomCoc] = useState(false);
  const [coc, setCoc] = useState(Math.round(autoCoc * 1000) / 1000);
  const cocUsed = customCoc ? coc : autoCoc;
  const r = depthOfField(camera.focalLength, camera.aperture, distance, cocUsed);

  return (
    <div className="stack">
      <Tabs
        value={tab}
        onChange={setTab}
        label="Depth of field mode"
        tabs={[
          { id: 'classic', label: 'Classic' },
          { id: 'inverse', label: 'Inverse' },
        ]}
      />
      <div className="tool">
        <div className="tool__controls stack">
          <Blueprint title="Camera" index="01">
            <CameraPicker />
          </Blueprint>
          <Blueprint title={tab === 'classic' ? 'Focus' : 'Target'} index="02">
            <div className="stack">
              {tab === 'classic' && (
                <Stepper label="Subject distance" unit={u.unit} value={u.toDisplay(distance)} onChange={(v) => setDistance(u.fromDisplay(v))} min={0.1} step={0.1} decimals={2} />
              )}
              {tab === 'inverse' && <Inverse coc={cocUsed} />}
              <Check label="Override circle of confusion (advanced)" checked={customCoc} onChange={setCustomCoc} />
              {customCoc && <NumberField label="Circle of confusion" unit="mm" value={coc} onChange={setCoc} min={0.001} max={0.2} step={0.001} hint={`Default for ${sensor.name}: ${autoCoc.toFixed(4)} mm (diagonal ÷ 1500).`} />}
            </div>
          </Blueprint>
        </div>
        {tab === 'classic' && (
          <div className="tool__results stack">
            <ResultPanel>
              <Readout label="Near limit" value={u.fmt(r.near)} />
              <Readout label="Far limit" value={u.fmt(r.far)} />
              <Readout label="Total depth" value={u.fmt(r.total)} size="lg" />
              <Readout label="In front" value={u.fmt(r.inFront)} size="sm" />
              <Readout label="Behind" value={u.fmt(r.behind)} size="sm" />
              <Readout label="Hyperfocal" value={u.fmt(r.hyperfocal)} size="sm" />
            </ResultPanel>
            <DofBar near={r.near} far={r.far} subject={distance} />
            <p className="small muted">
              {camera.focalLength} mm at {fmtAperture(camera.aperture)} on {sensor.name}, CoC {cocUsed.toFixed(4)} mm.{' '}
              <Link to="/calc/fov">Field of view for this lens</Link>
            </p>
            <Expander>
              <Formula>{`H = f² / (N · c) + f
near = s (H − f) / (H + s − 2f)
far  = s (H − f) / (H − s)      (∞ when s ≥ H)`}</Formula>
              <p>f = focal length, N = f-number, c = circle of confusion, s = subject distance, all in millimetres. The circle of confusion defaults to the sensor diagonal divided by 1500, a common print-viewing standard.</p>
            </Expander>
          </div>
        )}
      </div>
    </div>
  );
}

function DofBar({ near, far, subject }: { near: number; far: number; subject: number }) {
  const max = Number.isFinite(far) ? Math.max(far * 1.15, subject * 1.5) : subject * 3;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <div className="bp" style={{ padding: 'var(--s-3)' }} aria-hidden="true">
      <div style={{ position: 'relative', height: 28, background: 'var(--bg-2)', borderRadius: 2 }}>
        <div style={{ position: 'absolute', top: 6, bottom: 6, left: pct(near), width: Number.isFinite(far) ? `calc(${pct(far)} - ${pct(near)})` : `calc(100% - ${pct(near)})`, background: 'var(--yellow)', borderRadius: 2 }} />
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: pct(subject), width: 2, background: 'var(--fg)' }} />
      </div>
      <div className="cluster mono tiny muted" style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <span>0</span>
        <span>sharp zone in yellow · subject marked</span>
        <span>{Number.isFinite(far) ? fmtNum(max, 1) : '∞'}</span>
      </div>
    </div>
  );
}

function Inverse({ coc }: { coc: number }) {
  const { camera } = useCamera();
  const u = useUnits();
  const [want, setWant] = useState<'aperture' | 'distance'>('aperture');
  const [total, setTotal] = useState(1);
  const [distance, setDistance] = useState(3);
  const aperture = apertureForDof(camera.focalLength, distance, total, coc);
  const dist = distanceForDof(camera.focalLength, camera.aperture, total, coc);
  return (
    <div className="stack">
      <Segmented
        value={want}
        onChange={setWant}
        block
        label="Find"
        options={[
          { value: 'aperture', label: 'Aperture needed' },
          { value: 'distance', label: 'Distance needed' },
        ]}
      />
      <Stepper label="Desired total depth" unit={u.unit} value={u.toDisplay(total)} onChange={(v) => setTotal(u.fromDisplay(v))} min={0.01} step={0.1} decimals={2} />
      {want === 'aperture' && <Stepper label="Subject distance" unit={u.unit} value={u.toDisplay(distance)} onChange={(v) => setDistance(u.fromDisplay(v))} min={0.1} step={0.1} decimals={2} />}
      <ResultPanel tone="ink">
        {want === 'aperture' ? (
          <Readout label="Stop down to" value={Number.isNaN(aperture) ? 'Not possible' : fmtAperture(aperture)} size="lg" sub={Number.isNaN(aperture) ? 'Even f/128 cannot reach that depth here. Move back or go wider.' : 'then round to the nearest stop'} />
        ) : (
          <Readout label="Focus at" value={Number.isNaN(dist) ? 'Not possible' : u.fmt(dist)} size="lg" sub={Number.isNaN(dist) ? 'That depth needs a smaller aperture at this focal length.' : `at ${fmtAperture(camera.aperture)}; depth grows with distance`} />
        )}
      </ResultPanel>
    </div>
  );
}
