import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { Tabs } from '@/components/Tabs';
import { ResultPanel } from '../shared/ResultPanel';
import { CameraPicker } from '../shared/CameraPicker';
import { useCamera } from '../shared/useCamera';
import { useUnits } from '@/lib/useUnits';
import { fieldOfView, sceneSizeAtDistance, focalForSceneWidth } from '@/lib/calc/optics';
import { fmtDegrees, fmtNum } from '@/lib/format';

const VIDEO_CROPS = [
  { id: 'full', label: 'Full sensor width (1.00×)', crop: 1 },
  { id: '4k-oversampled', label: '4K oversampled, full width (1.00×)', crop: 1 },
  { id: '4k-crop-1.3', label: '4K crop mode (1.30×)', crop: 1.3 },
  { id: '4k-crop-1.56', label: '4K 60p crop, APS-C style (1.56×)', crop: 1.56 },
  { id: 'hd-crop-1.5', label: 'HD high-frame-rate crop (1.50×)', crop: 1.5 },
  { id: '4k-crop-1.7', label: '4K DCI pixel-for-pixel crop (1.74×)', crop: 1.74 },
];

export default function FovCalc() {
  const { camera, sensor, setCamera } = useCamera();
  const u = useUnits();
  const [tab, setTab] = useState<'forward' | 'inverse'>('forward');
  const [distance, setDistance] = useState(5);
  const [cropId, setCropId] = useState('full');
  const [wantWidth, setWantWidth] = useState(4);
  const crop = VIDEO_CROPS.find((c) => c.id === cropId)?.crop ?? 1;
  const w = sensor.width / crop;
  const h = sensor.height / crop;
  const fov = fieldOfView(camera.focalLength, w, h);
  const scene = sceneSizeAtDistance(camera.focalLength, w, h, distance);
  const focalNeeded = focalForSceneWidth(w, wantWidth, distance);

  return (
    <div className="stack">
      <Tabs
        value={tab}
        onChange={setTab}
        label="Field of view mode"
        tabs={[
          { id: 'forward', label: 'Angle and coverage' },
          { id: 'inverse', label: 'Focal length needed' },
        ]}
      />
      <div className="tool">
        <div className="tool__controls stack">
          <Blueprint title="Camera" index="01">
            <div className="stack">
              <CameraPicker aperture={false} focal={tab === 'forward'} />
              <SelectField label="Video recording crop" value={cropId} onChange={setCropId} options={VIDEO_CROPS.map((c) => ({ value: c.id, label: c.label }))} hint="Many cameras crop the sensor in some video modes. Pick the one that matches your mode." />
            </div>
          </Blueprint>
          <Blueprint title="Scene" index="02">
            <div className="stack">
              <Stepper label="Distance to scene" unit={u.unit} value={u.toDisplay(distance)} onChange={(v) => setDistance(u.fromDisplay(v))} min={0.1} step={0.5} decimals={2} />
              {tab === 'inverse' && <Stepper label="Scene width wanted" unit={u.unit} value={u.toDisplay(wantWidth)} onChange={(v) => setWantWidth(u.fromDisplay(v))} min={0.05} step={0.5} decimals={2} />}
            </div>
          </Blueprint>
        </div>
        <div className="tool__results stack">
          {tab === 'forward' ? (
            <ResultPanel>
              <Readout label="Horizontal" value={fmtDegrees(fov.horizontal)} />
              <Readout label="Vertical" value={fmtDegrees(fov.vertical)} />
              <Readout label="Diagonal" value={fmtDegrees(fov.diagonal)} />
              <Readout label={`Scene width at ${u.fmt(distance)}`} value={u.fmt(scene.width)} />
              <Readout label="Scene height" value={u.fmt(scene.height)} />
              <Readout label="Effective sensor" value={`${fmtNum(w, 1)} × ${fmtNum(h, 1)} mm`} size="sm" />
            </ResultPanel>
          ) : (
            <ResultPanel>
              <Readout label="Focal length needed" value={`${fmtNum(focalNeeded, 1)} mm`} size="lg" sub={`to cover ${u.fmt(wantWidth)} wide at ${u.fmt(distance)}`} />
              <div className="cluster">
                <button type="button" className="btn btn--sm" onClick={() => setCamera({ focalLength: Math.round(focalNeeded) })}>
                  Use {Math.round(focalNeeded)} mm
                </button>
              </div>
            </ResultPanel>
          )}
          <Expander>
            <Formula>{`angle = 2 · atan(d / 2f)        d = sensor width, height or diagonal
scene width = d · (s − f) / f    s = distance
f needed = d · s / (W + d)        W = scene width wanted`}</Formula>
            <p>Rectilinear lens focused near the scene. Video crops divide the sensor dimensions by the crop factor before the maths. 50 mm on full frame gives about 39.6° horizontal.</p>
          </Expander>
        </div>
      </div>
    </div>
  );
}
