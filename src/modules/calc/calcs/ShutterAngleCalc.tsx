import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { Segmented } from '@/components/Segmented';
import { SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { ShutterInput } from '../shared/ShutterInput';
import { useCamera } from '../shared/useCamera';
import { shutterFromAngle, angleFromShutter } from '@/lib/calc/motion';
import { FRAME_RATES } from '@/lib/calc/timecode';
import { fmtNum, fmtShutter } from '@/lib/format';
import { nearestStandardShutter } from '@/lib/calc/exposure';

export default function ShutterAngleCalc() {
  const { camera, setCamera } = useCamera();
  const [mode, setMode] = useState<'toShutter' | 'toAngle'>('toShutter');
  const [shutter, setShutter] = useState(1 / 50);
  const fps = camera.fps;
  const angle = camera.shutterAngle;
  const t = shutterFromAngle(angle, fps);
  const a = angleFromShutter(shutter, fps);

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Frame rate" index="01">
          <SelectField label="Frame rate" value={String(fps)} onChange={(v) => setCamera({ fps: Number(v) })} options={FRAME_RATES.map((f) => ({ value: String(f), label: `${f} fps` }))} />
        </Blueprint>
        <Blueprint title="Direction" index="02">
          <div className="stack">
            <Segmented
              value={mode}
              onChange={setMode}
              block
              label="Direction"
              options={[
                { value: 'toShutter', label: 'Angle to shutter' },
                { value: 'toAngle', label: 'Shutter to angle' },
              ]}
            />
            {mode === 'toShutter' ? (
              <Stepper label="Shutter angle" unit="°" value={angle} onChange={(v) => setCamera({ shutterAngle: v })} min={1} max={360} snaps={[11.25, 22.5, 45, 90, 144, 172.8, 180, 270, 360]} decimals={1} />
            ) : (
              <ShutterInput value={shutter} onChange={setShutter} />
            )}
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          {mode === 'toShutter' ? (
            <>
              <Readout label="Shutter" value={fmtShutter(t)} size="lg" sub={`${fmtNum(t * 1000, 2)} ms exposure per frame`} />
              <Readout label="Nearest standard" value={fmtShutter(nearestStandardShutter(t))} size="sm" />
            </>
          ) : (
            <>
              <Readout label="Shutter angle" value={`${fmtNum(a, 1)}°`} size="lg" sub={a > 360 ? 'longer than a frame: not possible' : a === 180 ? 'the 180-degree rule' : undefined} />
              <Readout label="Motion blur" value={a < 90 ? 'Crisp' : a <= 200 ? 'Natural' : 'Smeared'} size="sm" />
            </>
          )}
        </ResultPanel>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Angle</th>
                {[24, 25, 30, 50, 60, 120].map((f) => (
                  <th key={f} className="num">
                    {f} fps
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[45, 90, 172.8, 180, 270, 360].map((ang) => (
                <tr key={ang} className={ang === angle ? 'is-hi' : ''}>
                  <td className="num">{ang}°</td>
                  {[24, 25, 30, 50, 60, 120].map((f) => (
                    <td key={f} className="num">
                      {fmtShutter(shutterFromAngle(ang, f))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Expander>
          <Formula>{`shutter (s) = angle / (360 × fps)
angle = 360 × fps × shutter`}</Formula>
          <p>A 180° shutter exposes each frame for half the frame interval: 1/48 s at 24 fps, 1/50 s at 25 fps. Use 172.8° at 24 fps under 50 Hz lighting to avoid flicker.</p>
        </Expander>
      </div>
    </div>
  );
}
