import { compass } from '@/lib/format';

interface Props {
  sunAz: number;
  sunAlt: number;
  moonAz: number;
  moonAlt: number;
  shotBearing?: number;
  sunriseAz?: number;
  sunsetAz?: number;
}

/** Compass dial showing where the sun and moon are relative to the camera-to-subject line. Works offline. */
export function SunDial({ sunAz, sunAlt, moonAz, moonAlt, shotBearing, sunriseAz, sunsetAz }: Props) {
  const R = 100;
  const c = 120;
  const pt = (az: number, r: number) => {
    const a = ((az - 90) * Math.PI) / 180;
    return { x: c + r * Math.cos(a), y: c + r * Math.sin(a) };
  };
  // Radius encodes altitude: horizon on the ring, zenith at the centre.
  const rFor = (alt: number) => R * (1 - Math.max(0, Math.min(90, alt)) / 90);
  const sun = pt(sunAz, rFor(sunAlt));
  const moon = pt(moonAz, rFor(moonAlt));
  const sunUp = sunAlt > 0;
  const moonUp = moonAlt > 0;
  return (
    <svg viewBox="0 0 240 240" className="dial" role="img" aria-label={`Sun at ${Math.round(sunAz)}° ${compass(sunAz)}, elevation ${Math.round(sunAlt)}°. Moon at ${Math.round(moonAz)}°, elevation ${Math.round(moonAlt)}°.`}>
      <circle cx={c} cy={c} r={R} className="ring" strokeWidth="1" />
      <circle cx={c} cy={c} r={R * 0.667} className="ring" strokeWidth="1" strokeDasharray="2 4" />
      <circle cx={c} cy={c} r={R * 0.333} className="ring" strokeWidth="1" strokeDasharray="2 4" />
      {[0, 90, 180, 270].map((d) => {
        const a = pt(d, R);
        const b = pt(d, R + 6);
        return <line key={d} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="tick" strokeWidth="1.5" />;
      })}
      <text x={c} y={10} textAnchor="middle">
        N
      </text>
      <text x={c} y={236} textAnchor="middle">
        S
      </text>
      <text x={4} y={c + 4}>
        W
      </text>
      <text x={236} y={c + 4} textAnchor="end">
        E
      </text>
      {sunriseAz != null && (
        <line x1={c} y1={c} x2={pt(sunriseAz, R).x} y2={pt(sunriseAz, R).y} stroke="#e0ab00" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      )}
      {sunsetAz != null && (
        <line x1={c} y1={c} x2={pt(sunsetAz, R).x} y2={pt(sunsetAz, R).y} stroke="#e0ab00" strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
      )}
      {shotBearing != null && (
        <g>
          <line x1={c} y1={c} x2={pt(shotBearing, R).x} y2={pt(shotBearing, R).y} stroke="var(--fg)" strokeWidth="2" />
          <circle cx={pt(shotBearing, R).x} cy={pt(shotBearing, R).y} r="4" fill="var(--fg)" />
        </g>
      )}
      <line x1={c} y1={c} x2={pt(sunAz, R).x} y2={pt(sunAz, R).y} stroke="#e0ab00" strokeWidth={sunUp ? 2 : 1} opacity={sunUp ? 1 : 0.35} />
      <line x1={c} y1={c} x2={pt(moonAz, R).x} y2={pt(moonAz, R).y} stroke="#6f7fa8" strokeWidth={moonUp ? 2 : 1} opacity={moonUp ? 1 : 0.35} />
      <circle cx={sun.x} cy={sun.y} r="9" fill="#FFC400" stroke="#0B0B0C" strokeWidth="1.5" opacity={sunUp ? 1 : 0.3} />
      <circle cx={moon.x} cy={moon.y} r="7" fill="#c9d0e3" stroke="#0B0B0C" strokeWidth="1.5" opacity={moonUp ? 1 : 0.3} />
      <circle cx={c} cy={c} r="5" fill="var(--yellow)" stroke="var(--fg)" strokeWidth="1.5" />
    </svg>
  );
}
