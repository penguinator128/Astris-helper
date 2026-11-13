import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { Segmented } from '@/components/Segmented';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { CameraPicker } from '../shared/CameraPicker';
import { useCamera } from '../shared/useCamera';
import { useUnits } from '@/lib/useUnits';
import { distanceForSubject } from '@/lib/calc/optics';

const FRAMINGS: { id: string; label: string; fraction: number; note: string }[] = [
  { id: 'fill', label: 'Fill frame', fraction: 1, note: 'subject exactly fills the frame height' },
  { id: 'ws', label: 'Wide', fraction: 0.6, note: 'subject is 60% of frame height' },
  { id: 'ms', label: 'Medium', fraction: 0.9, note: 'waist up fills the frame (half the body shown)' },
  { id: 'loose', label: 'Loose', fraction: 0.8, note: 'subject with 20% headroom and footroom' },
];

export default function SubjectDistanceCalc() {
  const { camera, sensor } = useCamera();
  const u = useUnits();
  const [size, setSize] = useState(1.8);
  const [axis, setAxis] = useState<'height' | 'width'>('height');
  const [framing, setFraming] = useState('loose');
  const fr = FRAMINGS.find((f) => f.id === framing) ?? FRAMINGS[0];
  const sensorDim = axis === 'height' ? sensor.height : sensor.width;
  const visible = framing === 'ms' ? size * 0.5 : size;
  const d = distanceForSubject(camera.focalLength, sensorDim, visible, fr.fraction);

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Camera" index="01">
          <CameraPicker aperture={false} />
        </Blueprint>
        <Blueprint title="Subject" index="02">
          <div className="stack">
            <Segmented
              value={axis}
              onChange={setAxis}
              block
              label="Measure along"
              options={[
                { value: 'height', label: 'Subject height' },
                { value: 'width', label: 'Subject width' },
              ]}
            />
            <Stepper label={axis === 'height' ? 'Subject height' : 'Subject width'} unit={u.unit} value={u.toDisplay(size)} onChange={(v) => setSize(u.fromDisplay(v))} min={0.01} step={0.1} decimals={2} />
            <div className="field">
              <span className="field__label">Framing</span>
              <Segmented value={framing} onChange={setFraming} block options={FRAMINGS.map((f) => ({ value: f.id, label: f.label }))} label="Framing" />
              <span className="field__hint">{fr.note}</span>
            </div>
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Camera distance" value={u.fmt(d)} size="lg" sub={`${camera.focalLength} mm on ${sensor.name}`} />
        </ResultPanel>
        <Expander>
          <Formula>{`m = (sensor dimension × fraction) / subject size
d = f · (1 + 1/m)`}</Formula>
          <p>m is the magnification needed for the subject to cover that fraction of the frame; d is measured from the lens to the subject. A 1.8 m person filling a full-frame sensor’s height on a 50 mm lens needs 3.8 m.</p>
        </Expander>
      </div>
    </div>
  );
}
