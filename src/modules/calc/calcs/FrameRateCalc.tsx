import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { SelectField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { useCamera } from '../shared/useCamera';
import { slowMotion } from '@/lib/calc/motion';
import { FRAME_RATES } from '@/lib/calc/timecode';
import { fmtNum, fmtShutter } from '@/lib/format';

export default function FrameRateCalc() {
  const { camera, setCamera } = useCamera();
  const [shoot, setShoot] = useState(120);
  const [clipReal, setClipReal] = useState(2);
  const playback = camera.fps;
  const r = slowMotion(shoot, playback);
  const slowed = clipReal * r.slowFactor;

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Frame rates" index="01">
          <div className="stack">
            <SelectField label="Shooting frame rate" value={String(shoot)} onChange={(v) => setShoot(Number(v))} options={[...FRAME_RATES, 150, 180, 240, 300, 480, 1000].map((f) => ({ value: String(f), label: `${f} fps` }))} />
            <SelectField label="Playback (timeline) frame rate" value={String(playback)} onChange={(v) => setCamera({ fps: Number(v) })} options={FRAME_RATES.map((f) => ({ value: String(f), label: `${f} fps` }))} hint="Saved as the project frame rate." />
          </div>
        </Blueprint>
        <Blueprint title="Action" index="02">
          <Stepper label="Real-time length of the action" unit="s" value={clipReal} onChange={setClipReal} min={0.1} step={0.5} decimals={1} />
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Playback speed" value={`${fmtNum(r.speedPercent, r.speedPercent < 10 ? 1 : 0)}%`} size="lg" />
          <Readout label="Slowed" value={`${fmtNum(r.slowFactor, 2)}×`} sub={r.slowFactor < 1 ? 'faster than real time' : undefined} />
          <Readout label="Shutter at 180°" value={fmtShutter(r.recommendedShutter)} />
          <Readout label="Clip length on timeline" value={`${fmtNum(slowed, 1)} s`} sub={`from ${fmtNum(clipReal, 1)} s of action`} />
        </ResultPanel>
        <Expander>
          <Formula>{`speed % = playback fps / shooting fps × 100
slow factor = shooting fps / playback fps
shutter at 180° = 1 / (2 × shooting fps)`}</Formula>
          <p>Shutter follows the shooting frame rate, not the timeline. At 120 fps the 180° shutter is 1/240 s, so you will need more light or a higher ISO than at 24 fps. Audio does not survive conforming; plan for music or effects.</p>
        </Expander>
      </div>
    </div>
  );
}
