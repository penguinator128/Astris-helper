import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { NumberField, Check } from '@/components/Field';
import { Expander, Formula } from '@/components/Expander';
import { CameraPicker } from '../shared/CameraPicker';
import { useCamera } from '../shared/useCamera';
import { useUnits } from '@/lib/useUnits';
import { hyperfocal } from '@/lib/calc/optics';
import { COMMON_APERTURES, COMMON_FOCALS } from '@/lib/calc/sensors';

export default function HyperfocalCalc() {
  const { camera, sensor, coc: autoCoc } = useCamera();
  const u = useUnits();
  const [customCoc, setCustomCoc] = useState(false);
  const [coc, setCoc] = useState(Math.round(autoCoc * 1000) / 1000);
  const c = customCoc ? coc : autoCoc;
  const focals = Array.from(new Set([...COMMON_FOCALS, camera.focalLength])).sort((a, b) => a - b);
  const apertures = Array.from(new Set([...COMMON_APERTURES, camera.aperture])).sort((a, b) => a - b);

  return (
    <div className="stack">
      <div className="tool">
        <Blueprint title="Camera" index="01">
          <div className="stack">
            <CameraPicker />
            <Check label="Override circle of confusion" checked={customCoc} onChange={setCustomCoc} />
            {customCoc && <NumberField label="Circle of confusion" unit="mm" value={coc} onChange={setCoc} min={0.001} max={0.2} step={0.001} />}
            <p className="tiny muted">
              {sensor.name}, CoC {c.toFixed(4)} mm. Your current lens and aperture row and column are highlighted.
            </p>
          </div>
        </Blueprint>
        <div className="stack">
          <div className="table-wrap">
            <table className="table table--compact table--sticky">
              <thead>
                <tr>
                  <th>Focal</th>
                  {apertures.map((a) => (
                    <th key={a} className="num" style={a === camera.aperture ? { color: 'var(--fg)' } : undefined}>
                      f/{a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {focals.map((f) => (
                  <tr key={f} className={f === camera.focalLength ? 'is-hi' : ''}>
                    <td className="num">{f} mm</td>
                    {apertures.map((a) => (
                      <td key={a} className="num" style={a === camera.aperture ? { fontWeight: 500 } : undefined}>
                        {u.fmt(hyperfocal(f, a, c), 1)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Expander>
            <Formula>{`H = f² / (N · c) + f`}</Formula>
            <p>Focus at the hyperfocal distance and everything from half that distance to infinity is acceptably sharp. 50 mm at f/8 with a 0.029 mm circle of confusion gives about 10.8 m.</p>
          </Expander>
        </div>
      </div>
    </div>
  );
}
