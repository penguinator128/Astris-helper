import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { CameraPicker } from '../shared/CameraPicker';
import { useCamera } from '../shared/useCamera';
import { useUnits } from '@/lib/useUnits';
import { dollyZoomFocal, sceneSizeAtDistance } from '@/lib/calc/optics';
import { fmtNum } from '@/lib/format';

export default function DollyZoomCalc() {
  const { camera, sensor } = useCamera();
  const u = useUnits();
  const [startDist, setStartDist] = useState(2);
  const [endDist, setEndDist] = useState(6);
  const endFocal = dollyZoomFocal(camera.focalLength, startDist, endDist);
  const bgStart = sceneSizeAtDistance(camera.focalLength, sensor.width, sensor.height, startDist + 10).width;
  const bgEnd = sceneSizeAtDistance(endFocal, sensor.width, sensor.height, endDist + 10).width;
  const steps = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const d = startDist + (endDist - startDist) * t;
    return { d, f: dollyZoomFocal(camera.focalLength, startDist, d) };
  });

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Start of the move" index="01">
          <div className="stack">
            <CameraPicker aperture={false} />
            <Stepper label="Start distance to subject" unit={u.unit} value={u.toDisplay(startDist)} onChange={(v) => setStartDist(u.fromDisplay(v))} min={0.2} step={0.5} decimals={2} />
          </div>
        </Blueprint>
        <Blueprint title="End of the move" index="02">
          <Stepper label="End distance to subject" unit={u.unit} value={u.toDisplay(endDist)} onChange={(v) => setEndDist(u.fromDisplay(v))} min={0.2} step={0.5} decimals={2} />
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="End focal length" value={`${fmtNum(endFocal, 1)} mm`} size="lg" sub={`from ${camera.focalLength} mm at ${u.fmt(startDist)}`} />
          <Readout label="Zoom range" value={`${fmtNum(Math.min(camera.focalLength, endFocal), 0)}–${fmtNum(Math.max(camera.focalLength, endFocal), 0)} mm`} size="sm" />
          <Readout label="Background scale change" value={`${fmtNum(bgStart / bgEnd, 2)}×`} size="sm" sub="background 10 m behind subject" />
        </ResultPanel>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Progress</th>
                <th className="num">Distance</th>
                <th className="num">Focal</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={i}>
                  <td>{i * 25}%</td>
                  <td className="num">{u.fmt(s.d)}</td>
                  <td className="num">{fmtNum(s.f, 1)} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Expander>
          <Formula>{`subject size on sensor ∝ f / d
f₂ = f₁ × d₂ / d₁`}</Formula>
          <p>Keep the ratio of focal length to distance constant and the subject stays the same size while the background stretches or compresses. Check the zoom covers the end focal length before you rig the track.</p>
        </Expander>
      </div>
    </div>
  );
}
