import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Tabs } from '@/components/Tabs';
import { Segmented } from '@/components/Segmented';
import { Stepper } from '@/components/Stepper';
import { NumberField, SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { ShutterInput } from '../shared/ShutterInput';
import { Timer } from '../shared/Timer';
import { useCamera } from '../shared/useCamera';
import {
  exposureValue,
  shutterFromEv,
  apertureFromEv,
  isoFromEv,
  ndShutter,
  densityToStops,
  stopsToDensity,
  nearestStandardShutter,
  ND_PRESETS,
  EV_TABLE,
  STANDARD_APERTURES,
} from '@/lib/calc/exposure';
import { fmtAperture, fmtNum, fmtShutter } from '@/lib/format';

type Tab = 'triangle' | 'nd' | 'table';
type Solve = 'shutter' | 'aperture' | 'iso' | 'ev';

export default function ExposureCalc() {
  const [tab, setTab] = useState<Tab>('triangle');
  return (
    <div className="stack">
      <Tabs
        value={tab}
        onChange={setTab}
        label="Exposure tools"
        tabs={[
          { id: 'triangle', label: 'Triangle solver' },
          { id: 'nd', label: 'ND and long exposure' },
          { id: 'table', label: 'EV table' },
        ]}
      />
      {tab === 'triangle' && <Triangle />}
      {tab === 'nd' && <Nd />}
      {tab === 'table' && <EvTable />}
    </div>
  );
}

function Triangle() {
  const { camera, setCamera } = useCamera();
  const [shutter, setShutter] = useState(1 / 50);
  const [ev, setEv] = useState(12);
  const [solve, setSolve] = useState<Solve>('ev');
  const N = camera.aperture;
  const iso = camera.iso;

  const result = (() => {
    switch (solve) {
      case 'shutter':
        return { label: 'Shutter', value: fmtShutter(shutterFromEv(ev, N, iso)), sub: `nearest standard ${fmtShutter(nearestStandardShutter(shutterFromEv(ev, N, iso)))}` };
      case 'aperture':
        return { label: 'Aperture', value: fmtAperture(apertureFromEv(ev, shutter, iso)), sub: 'exact value; round to the nearest third stop' };
      case 'iso':
        return { label: 'ISO', value: fmtNum(isoFromEv(ev, N, shutter), 0), sub: 'exact value' };
      default:
        return { label: 'Exposure value', value: `EV ${fmtNum(exposureValue(N, shutter, iso), 1)}`, sub: `EV at ISO 100 would read ${fmtNum(exposureValue(N, shutter, 100), 1)}` };
    }
  })();

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Solve for" index="01">
          <Segmented
            value={solve}
            onChange={setSolve}
            block
            label="Solve for"
            options={[
              { value: 'ev', label: 'EV' },
              { value: 'shutter', label: 'Shutter' },
              { value: 'aperture', label: 'Aperture' },
              { value: 'iso', label: 'ISO' },
            ]}
          />
        </Blueprint>
        <Blueprint title="Known values" index="02">
          <div className="stack">
            {solve !== 'ev' && <Stepper label="Exposure value" unit="EV" value={ev} onChange={setEv} step={1 / 3} min={-10} max={22} decimals={1} />}
            {solve !== 'aperture' && <Stepper label="Aperture" unit="f/" value={N} onChange={(v) => setCamera({ aperture: v })} min={0.7} max={64} snaps={STANDARD_APERTURES} decimals={1} />}
            {solve !== 'shutter' && <ShutterInput value={shutter} onChange={setShutter} />}
            {solve !== 'iso' && <Stepper label="ISO" value={iso} onChange={(v) => setCamera({ iso: v })} min={25} max={409600} snaps={[50, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000, 10000, 12800, 25600, 51200, 102400]} />}
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label={result.label} value={result.value} size="lg" sub={result.sub} />
        </ResultPanel>
        <Expander>
          <p>Exposure value relates aperture, shutter and ISO. Higher EV means a brighter scene (less light admitted for the same result).</p>
          <Formula>{`EV = log2(N² / t) − log2(ISO / 100)
t = N² / 2^(EV + log2(ISO/100))
N = √(t · 2^(EV + log2(ISO/100)))`}</Formula>
          <p>Where N is the f-number and t the shutter time in seconds. Each full stop doubles or halves the light.</p>
        </Expander>
      </div>
    </div>
  );
}

function Nd() {
  const [base, setBase] = useState(1 / 125);
  const [mode, setMode] = useState<'stops' | 'density' | 'preset'>('stops');
  const [stops, setStops] = useState(10);
  const [density, setDensity] = useState(3);
  const effectiveStops = mode === 'density' ? densityToStops(density) : stops;
  const t = ndShutter(base, effectiveStops);
  const std = nearestStandardShutter(t);
  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Metered exposure" index="01">
          <ShutterInput label="Shutter without filter" value={base} onChange={setBase} />
        </Blueprint>
        <Blueprint title="Filter" index="02">
          <div className="stack">
            <Segmented
              value={mode}
              onChange={setMode}
              block
              label="Filter strength input"
              options={[
                { value: 'stops', label: 'Stops' },
                { value: 'density', label: 'Density' },
                { value: 'preset', label: 'ND name' },
              ]}
            />
            {mode === 'stops' && <Stepper label="ND strength" unit="stops" value={stops} onChange={setStops} min={0} max={20} step={1} />}
            {mode === 'density' && <NumberField label="Optical density" value={density} onChange={setDensity} min={0} max={6} step={0.1} />}
            {mode === 'preset' && (
              <SelectField
                label="Filter"
                value={String(stops)}
                onChange={(v) => setStops(Number(v))}
                options={ND_PRESETS.map((p) => ({ value: String(p.stops), label: `${p.label} · ${p.stops} stops · ${p.density.toFixed(1)} density` }))}
              />
            )}
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="New shutter" value={fmtShutter(t)} size="lg" sub={t >= 1 ? `${fmtNum(t, 1)} seconds` : undefined} />
          <Readout label="Nearest standard" value={fmtShutter(std)} size="sm" />
          <Readout label="Stops" value={fmtNum(effectiveStops, 1)} size="sm" />
          <Readout label="Density" value={fmtNum(stopsToDensity(effectiveStops), 2)} size="sm" />
          <Readout label="Factor" value={`${fmtNum(2 ** effectiveStops, 0)}×`} size="sm" />
        </ResultPanel>
        {t >= 1 && (
          <Blueprint title="Exposure timer" index="03">
            <Timer seconds={t} label="Long exposure" />
          </Blueprint>
        )}
        <Expander>
          <Formula>{`t_filtered = t_base × 2^stops
stops = density ÷ log10(2) = density × 3.32
factor = 2^stops`}</Formula>
          <p>Example: a 10-stop filter (ND1000, density 3.0) turns 1/125 s into 1024/125 ≈ 8.2 s. Add a little extra time for very long exposures if your filter is stronger than its rating, which many are.</p>
        </Expander>
      </div>
    </div>
  );
}

function EvTable() {
  const { camera } = useCamera();
  const N = camera.aperture;
  const iso = camera.iso;
  return (
    <div className="stack">
      <p className="small muted">
        Shutter speeds at {fmtAperture(N)} and ISO {iso} (the project camera). Change them in the triangle solver.
      </p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="num">EV</th>
              <th>Typical scene</th>
              <th className="num">Shutter</th>
            </tr>
          </thead>
          <tbody>
            {EV_TABLE.map((row) => (
              <tr key={row.ev}>
                <td className="num">{row.ev}</td>
                <td style={{ whiteSpace: 'normal' }}>{row.scene}</td>
                <td className="num">{fmtShutter(nearestStandardShutter(shutterFromEv(row.ev, N, iso)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Expander>
        <p>Scene EVs are referenced to ISO 100. Shutter is derived from the exposure equation at your chosen aperture and ISO, then snapped to the nearest standard third-stop value.</p>
      </Expander>
    </div>
  );
}
