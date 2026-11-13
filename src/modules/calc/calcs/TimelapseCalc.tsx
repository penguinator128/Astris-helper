import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Segmented } from '@/components/Segmented';
import { Stepper } from '@/components/Stepper';
import { NumberField, SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { Timer } from '../shared/Timer';
import { useCamera } from '../shared/useCamera';
import { timelapseFromClip, timelapseFromShoot, TIMELAPSE_INTERVALS } from '@/lib/calc/motion';
import { FRAME_RATES } from '@/lib/calc/timecode';
import { fmtBytes, fmtDuration, fmtNum } from '@/lib/format';

export default function TimelapseCalc() {
  const { camera, setCamera } = useCamera();
  const [mode, setMode] = useState<'clip' | 'shoot'>('clip');
  const [interval, setInterval] = useState(5);
  const [clip, setClip] = useState(10);
  const [shootMin, setShootMin] = useState(60);
  const [fileMb, setFileMb] = useState(25);
  const fps = camera.fps;
  const r = mode === 'clip' ? timelapseFromClip({ intervalS: interval, clipS: clip, playbackFps: fps, fileSizeMb: fileMb }) : timelapseFromShoot(interval, shootMin * 60, fps, fileMb);

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Known" index="01">
          <div className="stack">
            <Segmented
              value={mode}
              onChange={setMode}
              block
              label="Plan from"
              options={[
                { value: 'clip', label: 'Clip length wanted' },
                { value: 'shoot', label: 'Time available' },
              ]}
            />
            <Stepper label="Interval" unit="s" value={interval} onChange={setInterval} min={0.5} step={0.5} decimals={1} />
            {mode === 'clip' ? <Stepper label="Clip length" unit="s" value={clip} onChange={setClip} min={1} step={1} /> : <Stepper label="Shooting time" unit="min" value={shootMin} onChange={setShootMin} min={1} step={5} />}
            <SelectField label="Playback frame rate" value={String(fps)} onChange={(v) => setCamera({ fps: Number(v) })} options={FRAME_RATES.map((f) => ({ value: String(f), label: `${f} fps` }))} />
            <NumberField label="File size per frame" unit="MB" value={fileMb} onChange={setFileMb} min={0.1} step={1} hint="Raw stills are 20–45 MB; JPEGs 5–12 MB." />
          </div>
        </Blueprint>
        <Blueprint title="Interval guide" index="02" padding="none">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="num">Interval</th>
              </tr>
            </thead>
            <tbody>
              {TIMELAPSE_INTERVALS.map((row) => (
                <tr key={row.subject}>
                  <td style={{ whiteSpace: 'normal' }}>
                    <button type="button" className="btn btn--ghost btn--sm" style={{ padding: 0, minHeight: 28 }} onClick={() => setInterval(row.seconds[0])}>
                      {row.subject}
                    </button>
                  </td>
                  <td className="num">{row.interval}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Frames" value={fmtNum(r.frames, 0)} size="lg" />
          <Readout label="Shoot time" value={fmtDuration(r.shootS)} />
          <Readout label="Clip length" value={`${fmtNum(r.clipS, 1)} s`} />
          <Readout label="Storage" value={fmtBytes(r.storageGb)} />
          <Readout label="Speed-up" value={`${fmtNum(r.speedup, 0)}×`} size="sm" sub="real time compressed" />
        </ResultPanel>
        <Blueprint title="Shoot timer" index="03">
          <Timer seconds={r.shootS} label="Time lapse" />
        </Blueprint>
        <Expander>
          <Formula>{`frames = clip seconds × playback fps
shoot time = frames × interval
storage = frames × file size`}</Formula>
          <p>Keep the shutter slower than half the interval for smooth motion blur (the time-lapse equivalent of the 180° rule), and lock exposure or use aperture priority with smoothing for day-to-night transitions.</p>
        </Expander>
      </div>
    </div>
  );
}
