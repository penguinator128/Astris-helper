import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { Segmented } from '@/components/Segmented';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { useUnits } from '@/lib/useUnits';
import { inverseSquareStops, inverseSquareRatio, distanceForStops, powerStops } from '@/lib/calc/light';
import { fmtNum } from '@/lib/format';

export default function LightDistanceCalc() {
  const u = useUnits();
  const [mode, setMode] = useState<'move' | 'target' | 'power'>('move');
  const [d1, setD1] = useState(2);
  const [d2, setD2] = useState(4);
  const [stopsWanted, setStopsWanted] = useState(-1);
  const [p1, setP1] = useState(100);
  const [p2, setP2] = useState(50);
  const stops = inverseSquareStops(d1, d2);
  const ratio = inverseSquareRatio(d1, d2);
  const dNeeded = distanceForStops(d1, stopsWanted);
  const ps = powerStops(p1, p2);
  const sign = (v: number) => (v > 0 ? '+' : '');

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Question" index="01">
          <Segmented
            value={mode}
            onChange={setMode}
            block
            label="Question"
            options={[
              { value: 'move', label: 'Moving a light' },
              { value: 'target', label: 'Distance for stops' },
              { value: 'power', label: 'Dimming' },
            ]}
          />
        </Blueprint>
        <Blueprint title="Values" index="02">
          <div className="stack">
            {mode !== 'power' && <Stepper label="Current distance" unit={u.unit} value={u.toDisplay(d1)} onChange={(v) => setD1(u.fromDisplay(v))} min={0.05} step={0.25} decimals={2} />}
            {mode === 'move' && <Stepper label="New distance" unit={u.unit} value={u.toDisplay(d2)} onChange={(v) => setD2(u.fromDisplay(v))} min={0.05} step={0.25} decimals={2} />}
            {mode === 'target' && <Stepper label="Change wanted" unit="stops" value={stopsWanted} onChange={setStopsWanted} min={-10} max={10} step={1 / 3} decimals={2} hint="Positive = brighter." />}
            {mode === 'power' && (
              <div className="grid-2">
                <Stepper label="From" unit="%" value={p1} onChange={setP1} min={1} max={100} step={5} />
                <Stepper label="To" unit="%" value={p2} onChange={setP2} min={1} max={100} step={5} />
              </div>
            )}
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          {mode === 'move' && (
            <>
              <Readout label="Change at subject" value={`${sign(stops)}${fmtNum(stops, 2)} stops`} size="lg" />
              <Readout label="Relative intensity" value={`${fmtNum(ratio * 100, ratio < 0.1 ? 1 : 0)}%`} />
            </>
          )}
          {mode === 'target' && <Readout label="Move the light to" value={u.fmt(dNeeded)} size="lg" sub={`for ${sign(stopsWanted)}${fmtNum(stopsWanted, 2)} stops`} />}
          {mode === 'power' && <Readout label="Change" value={`${sign(ps)}${fmtNum(ps, 2)} stops`} size="lg" sub="assuming linear dimming" />}
        </ResultPanel>
        <Expander>
          <Formula>{`intensity ∝ 1 / d²
stops = 2 × log2(d₁ / d₂)
d₂ = d₁ / √(2^stops)
dimming stops = log2(P₂ / P₁)`}</Formula>
          <p>Doubling the distance costs two stops; moving a light from 2 m to 1.4 m gains one. Large soft sources close to the subject fall off faster across the frame than small hard ones far away, so use this to shape contrast, not only exposure.</p>
        </Expander>
      </div>
    </div>
  );
}
