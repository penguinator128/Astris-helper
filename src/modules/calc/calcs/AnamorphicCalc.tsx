import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { anamorphic } from '@/lib/calc/optics';
import { fmtNum } from '@/lib/format';

const RECORDING = [
  { id: '3840x2160', w: 3840, h: 2160, label: 'UHD 3840 × 2160 (16:9)' },
  { id: '4096x2160', w: 4096, h: 2160, label: 'DCI 4K 4096 × 2160' },
  { id: '4096x3072', w: 4096, h: 3072, label: '4:3 open gate 4096 × 3072' },
  { id: '5760x4320', w: 5760, h: 4320, label: '4:3 open gate 5760 × 4320' },
  { id: '6000x4000', w: 6000, h: 4000, label: '3:2 open gate 6000 × 4000' },
  { id: '1920x1080', w: 1920, h: 1080, label: 'HD 1920 × 1080' },
];

export default function AnamorphicCalc() {
  const [squeeze, setSqueeze] = useState(1.33);
  const [recId, setRecId] = useState('3840x2160');
  const rec = RECORDING.find((r) => r.id === recId) ?? RECORDING[0];
  const r = anamorphic(squeeze, rec.w, rec.h);
  const aspectLabel = (a: number) => `${fmtNum(a, 2)}:1`;

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Lens and sensor mode" index="01">
          <div className="stack">
            <Stepper label="Squeeze factor" unit="×" value={squeeze} onChange={setSqueeze} min={1} max={2} snaps={[1, 1.33, 1.5, 1.6, 1.8, 2]} decimals={2} />
            <SelectField label="Recording resolution" value={recId} onChange={setRecId} options={RECORDING.map((x) => ({ value: x.id, label: x.label }))} />
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="De-squeezed aspect" value={aspectLabel(r.desqueezedAspect)} size="lg" />
          <Readout label="Delivery size" value={`${r.deliveryWidth} × ${r.deliveryHeight}`} sub="stretch horizontally in post" />
          <Readout label="Recorded aspect" value={aspectLabel(r.capturedAspect)} size="sm" />
          <Readout label="Fit to 2.39:1" value={r.desqueezedAspect >= 2.39 ? 'Crop the sides' : 'Letterbox or crop top and bottom'} size="sm" />
        </ResultPanel>
        <Expander>
          <Formula>{`de-squeezed aspect = (width / height) × squeeze
delivery width = width × squeeze`}</Formula>
          <p>A 1.33× lens on a 16:9 sensor gives about 2.37:1, close to the 2.39:1 scope standard. A 2× lens on 4:3 open gate gives 2.67:1, which is usually cropped to 2.39:1. Set the monitor de-squeeze to the same factor.</p>
        </Expander>
      </div>
    </div>
  );
}
