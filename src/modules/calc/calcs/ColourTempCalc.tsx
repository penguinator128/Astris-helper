import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { kelvinToMired, miredShift, suggestGels, COLOUR_TEMP_PRESETS } from '@/lib/calc/light';
import { kelvinToHex } from '@/lib/colour/kelvin';
import { fmtNum } from '@/lib/format';

export default function ColourTempCalc() {
  const [source, setSource] = useState(5600);
  const [target, setTarget] = useState(3200);
  const shift = miredShift(source, target);
  const advice = suggestGels(source, target);
  const sign = (v: number) => (v > 0 ? '+' : '');

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Sources" index="01">
          <div className="stack">
            <KelvinField label="Light you have" value={source} onChange={setSource} />
            <KelvinField label="Match it to" value={target} onChange={setTarget} />
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Correction needed" value={`${sign(shift)}${fmtNum(shift, 0)} mired`} size="lg" sub={shift > 0 ? 'warm it (CTO)' : shift < 0 ? 'cool it (CTB)' : 'no correction'} />
          <Readout label="Source" value={`${fmtNum(kelvinToMired(source), 0)} mired`} size="sm" />
          <Readout label="Target" value={`${fmtNum(kelvinToMired(target), 0)} mired`} size="sm" />
        </ResultPanel>
        <Blueprint title="Gel suggestion" index="02">
          <div className="stack stack--sm">
            <div className="cluster" style={{ justifyContent: 'space-between' }}>
              <span>
                <strong>{advice.single.gels.map((g) => g.name).join(' + ')}</strong>
                <span className="muted small"> → about {fmtNum(advice.single.resultK, 0)} K</span>
              </span>
              <span className="tag">{fmtNum(advice.single.errorMired, 0)} mired off</span>
            </div>
            {advice.pair && (
              <div className="cluster" style={{ justifyContent: 'space-between' }}>
                <span>
                  <strong>{advice.pair.gels.map((g) => g.name).join(' + ')}</strong>
                  <span className="muted small"> → about {fmtNum(advice.pair.resultK, 0)} K</span>
                </span>
                <span className="tag">{fmtNum(advice.pair.errorMired, 0)} mired off</span>
              </div>
            )}
            <p className="tiny muted">Every gel costs light: full CTO about one stop, full CTB about one and two-thirds. White-balance the camera to the target.</p>
          </div>
        </Blueprint>
        <Expander>
          <Formula>{`mired = 1 000 000 / kelvin
shift = mired(target) − mired(source)`}</Formula>
          <p>Mired shifts add up and are the same size regardless of where on the kelvin scale you start, which is why gels are rated in mired rather than kelvin. Positive shifts warm (orange), negative shifts cool (blue).</p>
        </Expander>
      </div>
    </div>
  );
}

function KelvinField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="stack stack--sm">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px', gap: 'var(--s-2)', alignItems: 'end' }}>
        <Stepper label={label} unit="K" value={value} onChange={onChange} min={1000} max={20000} step={100} />
        <div aria-hidden="true" style={{ height: 44, border: '1px solid var(--hair-strong)', borderRadius: 4, background: kelvinToHex(value) }} />
      </div>
      <SelectField label="Preset" value="" onChange={(v) => v && onChange(Number(v))} options={[{ value: '', label: 'Choose a preset' }, ...COLOUR_TEMP_PRESETS.map((p) => ({ value: String(p.k), label: `${p.name} · ${p.k} K` }))]} />
    </div>
  );
}
