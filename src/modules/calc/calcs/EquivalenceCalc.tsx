import { useState } from 'react';
import { Blueprint } from '@/components/Blueprint';
import { SelectField } from '@/components/Field';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { CameraPicker } from '../shared/CameraPicker';
import { useCamera } from '../shared/useCamera';
import { lensEquivalence } from '@/lib/calc/optics';
import { getSensor, SENSORS } from '@/lib/calc/sensors';
import { fmtAperture, fmtNum } from '@/lib/format';

export default function EquivalenceCalc() {
  const { camera, sensor } = useCamera();
  const [targetId, setTargetId] = useState('full-frame');
  const target = getSensor(targetId);
  const e = lensEquivalence(camera.focalLength, camera.aperture, sensor.crop, target.crop);

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Lens on the project camera" index="01">
          <CameraPicker />
        </Blueprint>
        <Blueprint title="Compare with" index="02">
          <SelectField label="Target sensor" value={targetId} onChange={setTargetId} options={SENSORS.map((s) => ({ value: s.id, label: `${s.name} (${s.crop.toFixed(2)}×)` }))} />
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label={`Looks like, on ${target.name}`} value={`${fmtNum(e.focal, 0)} mm`} size="lg" />
          <Readout label="Equivalent aperture" value={fmtAperture(e.aperture)} sub="same depth of field and total light" />
          <Readout label="Crop ratio" value={`${fmtNum(sensor.crop / target.crop, 2)}×`} size="sm" />
        </ResultPanel>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>Sensor</th>
                <th className="num">Crop</th>
                <th className="num">Equivalent</th>
              </tr>
            </thead>
            <tbody>
              {SENSORS.map((s) => {
                const eq = lensEquivalence(camera.focalLength, camera.aperture, sensor.crop, s.crop);
                return (
                  <tr key={s.id} className={s.id === sensor.id ? 'is-hi' : ''}>
                    <td>{s.name}</td>
                    <td className="num">{s.crop.toFixed(2)}×</td>
                    <td className="num">
                      {fmtNum(eq.focal, 0)} mm {fmtAperture(eq.aperture)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Expander>
          <Formula>{`k = crop_source / crop_target
equivalent focal = f × k
equivalent aperture = N × k`}</Formula>
          <p>Equivalence matches angle of view and depth of field. Exposure (brightness per area) does not change with sensor size, so the f-number for metering stays what it says on the lens.</p>
        </Expander>
      </div>
    </div>
  );
}
