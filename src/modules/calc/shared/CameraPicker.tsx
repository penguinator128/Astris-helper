import { SelectField, NumberField } from '@/components/Field';
import { Stepper } from '@/components/Stepper';
import { SENSORS, STANDARD_APERTURES_SNAPS } from './constants';
import { useCamera } from './useCamera';

interface Props {
  focal?: boolean;
  aperture?: boolean;
  sensor?: boolean;
}

/** Sensor, focal length and aperture, persisted per project. */
export function CameraPicker({ focal = true, aperture = true, sensor = true }: Props) {
  const { camera, setCamera } = useCamera();
  const custom = camera.customSensor ?? { width: 36, height: 24, name: 'Custom' };
  return (
    <div className="stack">
      {sensor && (
        <SelectField
          label="Sensor"
          value={camera.sensorId}
          onChange={(v) => setCamera({ sensorId: v, customSensor: v === 'custom' ? custom : camera.customSensor })}
          options={[...SENSORS.map((s) => ({ value: s.id, label: `${s.name} · ${s.width} × ${s.height} mm` })), { value: 'custom', label: 'Custom sensor' }]}
        />
      )}
      {sensor && camera.sensorId === 'custom' && (
        <div className="grid-2">
          <NumberField label="Sensor width" unit="mm" value={custom.width} onChange={(v) => setCamera({ customSensor: { ...custom, width: v } })} min={1} />
          <NumberField label="Sensor height" unit="mm" value={custom.height} onChange={(v) => setCamera({ customSensor: { ...custom, height: v } })} min={1} />
        </div>
      )}
      {(focal || aperture) && (
        <div className="grid-2">
          {focal && <Stepper label="Focal length" unit="mm" value={camera.focalLength} onChange={(v) => setCamera({ focalLength: v })} min={1} max={2000} />}
          {aperture && (
            <Stepper label="Aperture" unit="f/" value={camera.aperture} onChange={(v) => setCamera({ aperture: v })} min={0.7} max={64} snaps={STANDARD_APERTURES_SNAPS} decimals={1} />
          )}
        </div>
      )}
    </div>
  );
}
