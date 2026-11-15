import type { DiagramLight, Diffusion, Environment, EnvPreset, LightFixture } from '@/types/project';

const base: Omit<Environment, 'preset'> = {
  outdoor: false, wallColour: '#2c2c30', floorColour: '#3a3a3e', wallReflect: 0.05, material: 'matte', wallDistance: 6, roomWidth: 12, ceilingHeight: 4, ambientLux: 0, ambientKelvin: 5600, sun: false, sunAzimuth: 135, sunElevation: 40,
};

export const ENV_PRESETS: { id: EnvPreset; label: string; note: string; env: Omit<Environment, 'preset'> }[] = [
  { id: 'white-studio', label: 'White studio', note: 'White walls, floor and ceiling bounce your lights back as soft fill.', env: { ...base, wallColour: '#f2f1ed', floorColour: '#e6e4de', wallReflect: 0.85, wallDistance: 2.5, roomWidth: 6, ceilingHeight: 3, ambientLux: 20 } },
  { id: 'dark-studio', label: 'Dark studio', note: 'Black drapes. Only your lights count.', env: { ...base } },
  { id: 'daylight', label: 'Outdoor daylight', note: 'Direct sun plus blue sky fill. Expect very high light levels.', env: { ...base, outdoor: true, floorColour: '#77745f', wallReflect: 0.2, ambientLux: 15000, ambientKelvin: 7500, sun: true } },
  { id: 'overcast', label: 'Overcast', note: 'Huge soft source from the whole sky. Low contrast.', env: { ...base, outdoor: true, floorColour: '#6d6c63', wallReflect: 0.2, ambientLux: 4000, ambientKelvin: 6500 } },
  { id: 'natural-indoor', label: 'Natural indoor', note: 'A room lit by windows; light walls.', env: { ...base, wallColour: '#d9d3c6', floorColour: '#8d7a62', wallReflect: 0.6, wallDistance: 3, roomWidth: 5, ceilingHeight: 2.7, ambientLux: 250, ambientKelvin: 5800 } },
  { id: 'warm-indoor', label: 'Warm indoor', note: 'Tungsten household lighting.', env: { ...base, wallColour: '#cdb894', floorColour: '#6e5640', wallReflect: 0.5, wallDistance: 3, roomWidth: 5, ceilingHeight: 2.7, ambientLux: 120, ambientKelvin: 2900 } },
  { id: 'low-light', label: 'Low light', note: 'Night interior or dusk. Practicals and little else.', env: { ...base, wallColour: '#3c3631', floorColour: '#2d2620', wallReflect: 0.2, wallDistance: 3, roomWidth: 5, ceilingHeight: 2.7, ambientLux: 8, ambientKelvin: 2700 } },
];

export function presetEnv(id: EnvPreset): Environment {
  const p = ENV_PRESETS.find((x) => x.id === id) ?? ENV_PRESETS[1];
  return { ...p.env, preset: id };
}

/** Plans made before environments existed keep the look they had: a dark studio. */
export function envOf(d: { environment?: Environment } | undefined): Environment {
  return d?.environment ?? presetEnv('dark-studio');
}

export const FIXTURES: { id: LightFixture; label: string; output: number; size: number; spread: number; note: string }[] = [
  { id: 'led-mono', label: 'LED monolight (open)', output: 1, size: 0.15, spread: 55, note: 'Hard, bright, punchy.' },
  { id: 'fresnel', label: 'Fresnel', output: 0.9, size: 0.2, spread: 30, note: 'Focusable beam with clean edges.' },
  { id: 'softbox', label: 'Softbox', output: 0.55, size: 0.9, spread: 90, note: 'Soft, directional.' },
  { id: 'lantern', label: 'Lantern / china ball', output: 0.45, size: 0.65, spread: 170, note: 'Soft, goes everywhere.' },
  { id: 'led-panel', label: 'LED panel', output: 0.5, size: 0.35, spread: 60, note: 'Even and fairly soft.' },
  { id: 'rgb-panel', label: 'RGB LED panel', output: 0.45, size: 0.3, spread: 60, note: 'Any colour. Set it with the colour picker.' },
  { id: 'tube', label: 'LED tube', output: 0.25, size: 0.6, spread: 160, note: 'Long, thin, often in shot.' },
  { id: 'practical-bulb', label: 'Practical bulb', output: 0.12, size: 0.08, spread: 300, note: 'A lamp in the scene.' },
  { id: 'open-face', label: 'Open-face tungsten', output: 1.1, size: 0.12, spread: 70, note: 'Hot, hard and warm.' },
];

export const DIFFUSION: { id: Diffusion; label: string; output: number; size: number }[] = [
  { id: 'none', label: 'None', output: 1, size: 1 },
  { id: 'light', label: 'Light (1/4 grid)', output: 0.8, size: 1.5 },
  { id: 'medium', label: 'Medium (1/2 grid)', output: 0.62, size: 2 },
  { id: 'heavy', label: 'Heavy (full grid)', output: 0.42, size: 3 },
];

export function fixtureInfo(id?: LightFixture) {
  return FIXTURES.find((f) => f.id === id);
}

/** Output and effective source size after the fixture and its diffusion. */
export function effectiveLight(l: DiagramLight): { output: number; size: number } {
  const f = fixtureInfo(l.fixture);
  const d = DIFFUSION.find((x) => x.id === l.diffusion) ?? DIFFUSION[0];
  return { output: (f?.output ?? 1) * d.output, size: l.size * d.size };
}

/** Relative units: 0.25 is a 100% open key at 2 m, which reads as about 200 lux. */
export const LUX_PER_REL = 800;

/**
 * Light bouncing around a closed room. Integrating-sphere estimate:
 * E = ρ / (1 − ρ) × Φ / A, with Φ the flux of each light and A the room's surfaces.
 */
export function roomBounceRel(env: Environment, lights: DiagramLight[], emitting: (l: DiagramLight) => boolean): number {
  const rho = Math.min(0.92, Math.max(0, env.wallReflect));
  if (rho < 0.01) return 0;
  // Outdoors only the ground bounces, and much of it escapes.
  const area = env.outdoor ? 400 : 2 * env.roomWidth * env.roomWidth + 4 * env.roomWidth * env.ceilingHeight;
  let flux = 0;
  for (const l of lights) {
    if (!emitting(l) || l.kind === 'sun') continue;
    const intensity = (l.power / 100) * effectiveLight(l).output * (l.kind === 'window' ? 2.5 : l.kind === 'practical' ? 0.35 : 1);
    const half = Math.min(Math.PI, ((l.spread / 2) * Math.PI) / 180);
    flux += 2 * Math.PI * intensity * (1 - Math.cos(half));
  }
  return (rho / (1 - rho)) * (flux / area) * (env.outdoor ? 0.2 : 1);
}

export function ambientRel(env: Environment): number {
  return env.ambientLux / LUX_PER_REL;
}
