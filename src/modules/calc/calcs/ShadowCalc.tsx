import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Blueprint } from '@/components/Blueprint';
import { Stepper } from '@/components/Stepper';
import { Segmented } from '@/components/Segmented';
import { Readout } from '@/components/Readout';
import { Expander, Formula } from '@/components/Expander';
import { ResultPanel } from '../shared/ResultPanel';
import { useUnits } from '@/lib/useUnits';
import { shadowLength, sunPosition } from '@/lib/sun';
import { useSettings } from '@/store/settings';
import { compass, fmtDegrees, fmtNum } from '@/lib/format';

export default function ShadowCalc() {
  const u = useUnits();
  const { location } = useSettings();
  const [height, setHeight] = useState(1.8);
  const [mode, setMode] = useState<'now' | 'manual'>('now');
  const [elevation, setElevation] = useState(45);
  const now = useMemo(() => new Date(), []);
  const sun = useMemo(() => sunPosition(now, location.lat, location.lng), [now, location.lat, location.lng]);
  const alt = mode === 'now' ? sun.altitude : elevation;
  const len = shadowLength(height, alt);
  const shadowBearing = (sun.azimuth + 180) % 360;

  return (
    <div className="tool">
      <div className="tool__controls stack">
        <Blueprint title="Object" index="01">
          <Stepper label="Height" unit={u.unit} value={u.toDisplay(height)} onChange={(v) => setHeight(u.fromDisplay(v))} min={0.01} step={0.1} decimals={2} />
        </Blueprint>
        <Blueprint title="Sun" index="02">
          <div className="stack">
            <Segmented
              value={mode}
              onChange={setMode}
              block
              label="Sun elevation source"
              options={[
                { value: 'now', label: `Now at ${location.name}` },
                { value: 'manual', label: 'Enter elevation' },
              ]}
            />
            {mode === 'manual' ? (
              <Stepper label="Sun elevation" unit="°" value={elevation} onChange={setElevation} min={0} max={90} step={1} />
            ) : (
              <p className="small muted">
                Sun is at {fmtDegrees(sun.altitude)} elevation, azimuth {fmtDegrees(sun.azimuth, 0)} ({compass(sun.azimuth)}). <Link to="/plan">Pick another time in the planner.</Link>
              </p>
            )}
          </div>
        </Blueprint>
      </div>
      <div className="tool__results stack">
        <ResultPanel>
          <Readout label="Shadow length" value={alt <= 0 ? 'No sun' : u.fmt(len)} size="lg" sub={alt > 0 ? `${fmtNum(len / height, 2)}× the height` : 'sun is below the horizon'} />
          {mode === 'now' && alt > 0 && <Readout label="Shadow points" value={`${compass(shadowBearing)} ${fmtDegrees(shadowBearing, 0)}`} size="sm" />}
        </ResultPanel>
        <Expander>
          <Formula>{`shadow = height / tan(elevation)`}</Formula>
          <p>At 45° the shadow equals the height; at 30° it is 1.73× longer; at 10° it is 5.7×. Shadows fall directly away from the sun’s azimuth.</p>
        </Expander>
      </div>
    </div>
  );
}
