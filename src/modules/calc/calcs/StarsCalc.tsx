import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { NumberField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { CameraPicker } from '../shared/CameraPicker';
import { useCamera } from '../shared/useCamera';
import { rule500, npfRule, starTrail, trailSequence } from '@/lib/calc/astro';
import { nearestStandardShutter } from '@/lib/calc/exposure';
import { fmtDuration, fmtNum, fmtShutter } from '@/lib/format';

export default function StarsCalc() {
  const { camera, sensor } = useCamera();
  const [pitch, setPitch] = useState(sensor.pixelPitch ?? 4.3);
  const [declination, setDeclination] = useState(0);
  const [exposure, setExposure] = useState(30);
  const [frames, setFrames] = useState(120);
  const [intervalS, setIntervalS] = useState(32);
  const npf = npfRule(camera.focalLength, camera.aperture, pitch, declination);
  const r500 = rule500(camera.focalLength, sensor.crop);
  const trail = starTrail(exposure, camera.focalLength, pitch, declination);
  const seq = trailSequence(frames, exposure, intervalS);

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Camera" index="01">
          <div className="stack">
            <CameraPicker />
            <NumberField label="Pixel pitch" unit="µm" value={pitch} onChange={setPitch} min={1} max={12} step={0.1} hint={`Sensor width ÷ pixels across. ${sensor.pixelPitch ? `Typical for ${sensor.name}: ${sensor.pixelPitch} µm.` : ''}`} />
            <Stepper label="Declination of the framed sky" unit="°" value={declination} onChange={setDeclination} min={0} max={89} step={5} hint="0° at the celestial equator (longest trails); higher near the pole." />
          </div>
        </Blueprint>
        <Blueprint title="Star trails" index="02">
          <div className="stack">
            <Stepper label="Exposure per frame" unit="s" value={exposure} onChange={setExposure} min={1} step={5} />
            <div className="grid-2">
              <Stepper label="Frames" value={frames} onChange={setFrames} min={1} step={10} />
              <Stepper label="Interval" unit="s" value={intervalS} onChange={setIntervalS} min={1} step={1} />
            </div>
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel title="Pinpoint stars">
          <Readout label="NPF rule" value={`${fmtNum(npf, 1)} s`} size="lg" sub={`use ${fmtShutter(nearestStandardShutter(npf))}`} />
          <Readout label="500 rule" value={`${fmtNum(r500, 1)} s`} sub="older, looser guide" />
        </ResultPanel>
        <ResultPanel title="Trails" tone="ink">
          <Readout label={`Trail in ${exposure} s`} value={`${fmtNum(trail.trailPx, 1)} px`} sub={`${fmtNum(trail.trailMm * 1000, 1)} µm on sensor`} />
          <Readout label="Sequence" value={fmtDuration(seq.totalS)} sub={`${fmtNum(seq.angleDeg, 1)}° of sky rotation`} />
        </ResultPanel>
        <Expander>
          <Formula>{`NPF: t = (35 N + 30 p) / f           p = pixel pitch (µm), f in mm
500 rule: t = 500 / (f × crop)
sidereal rate = 360° / 86 164 s = 0.004178°/s
trail (mm) = f × tan(rate × t × cos δ)`}</Formula>
          <p>NPF accounts for aperture and pixel size, so it gives shorter and more honest limits than the 500 rule on modern high-resolution sensors. Trails are longest at the celestial equator and shrink towards the pole by cos(declination).</p>
        </Expander>
      </div>
    </div>
  );
}
