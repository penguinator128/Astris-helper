import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Tabs } from '@/components/Tabs';
import { SelectField, TextField, NumberField, Check } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { useCamera } from '../shared/useCamera';
import { parseTimecode, timecodeToFrames, framesToTimecode, formatTimecode, addTimecodes, subtractTimecodes, isDropFrameRate, FRAME_RATES } from '@/lib/calc/timecode';
import { fmtDuration } from '@/lib/format';

export default function TimecodeCalc() {
  const { camera, setCamera } = useCamera();
  const fps = camera.fps;
  const [tab, setTab] = useState<'math' | 'convert'>('math');
  const [df, setDf] = useState(false);
  const dropFrame = df && isDropFrameRate(fps);
  const [a, setA] = useState('01:00:00:00');
  const [b, setB] = useState('00:00:30:12');
  const [frames, setFrames] = useState(1800);
  const [tcIn, setTcIn] = useState('00:01:12:00');

  const ta = parseTimecode(a);
  const tb = parseTimecode(b);
  const sum = ta && tb ? addTimecodes(ta, tb, fps, dropFrame) : null;
  const diff = ta && tb ? subtractTimecodes(ta, tb, fps, dropFrame) : null;
  const tcParsed = parseTimecode(tcIn);

  return (
    <div className="stack">
      <Tabs
        value={tab}
        onChange={setTab}
        label="Timecode tools"
        tabs={[
          { id: 'math', label: 'Add and subtract' },
          { id: 'convert', label: 'Frames and timecode' },
        ]}
      />
      <div className="tool">
        <div className="tool__controls stack">
          <Blueprint title="Frame rate" index="01">
            <div className="stack">
              <SelectField label="Frame rate" value={String(fps)} onChange={(v) => setCamera({ fps: Number(v) })} options={FRAME_RATES.map((f) => ({ value: String(f), label: `${f} fps` }))} />
              <Check label="Drop-frame (29.97 and 59.94 only)" checked={df} onChange={setDf} disabled={!isDropFrameRate(fps)} />
            </div>
          </Blueprint>
          <Blueprint title={tab === 'math' ? 'Timecodes' : 'Input'} index="02">
            <div className="stack">
              {tab === 'math' ? (
                <>
                  <TextField label="Timecode A" value={a} onChange={setA} mono placeholder="HH:MM:SS:FF" />
                  <TextField label="Timecode B" value={b} onChange={setB} mono placeholder="HH:MM:SS:FF" />
                </>
              ) : (
                <>
                  <NumberField label="Frame count" value={frames} onChange={setFrames} min={0} step={1} />
                  <TextField label="Timecode" value={tcIn} onChange={setTcIn} mono placeholder="HH:MM:SS:FF" />
                </>
              )}
            </div>
          </Blueprint>
        </div>
        <div className="tool__results stack">
          {tab === 'math' ? (
            <ResultPanel>
              <Readout label="A + B" value={sum ? formatTimecode(sum, dropFrame) : 'Check format'} />
              <Readout label="A − B" value={diff ? formatTimecode(diff, dropFrame) : 'Check format'} />
              {ta && tb && (
                <>
                  <Readout label="A in frames" value={String(timecodeToFrames(ta, fps, dropFrame))} size="sm" />
                  <Readout label="B in frames" value={String(timecodeToFrames(tb, fps, dropFrame))} size="sm" />
                </>
              )}
            </ResultPanel>
          ) : (
            <ResultPanel>
              <Readout label={`${frames} frames`} value={formatTimecode(framesToTimecode(frames, fps, dropFrame), dropFrame)} sub={fmtDuration(frames / fps)} />
              <Readout label={tcIn} value={tcParsed ? `${timecodeToFrames(tcParsed, fps, dropFrame)} frames` : 'Check format'} sub={tcParsed ? fmtDuration(timecodeToFrames(tcParsed, fps, dropFrame) / fps) : undefined} />
            </ResultPanel>
          )}
          <Expander>
            <Formula>{`frames = ((h × 60 + m) × 60 + s) × fps + f
drop-frame: skip frames 0 and 1 (29.97) or 0–3 (59.94) each minute,
except every tenth minute`}</Formula>
            <p>Drop-frame keeps 29.97 fps timecode in step with the clock by skipping numbers, not frames. Non-drop timecode drifts about 3.6 s an hour but is simpler to add up.</p>
          </Expander>
        </div>
      </div>
    </div>
  );
}
