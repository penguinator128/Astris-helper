import type { ComponentType } from 'react';

export interface CalcDef {
  id: string;
  index: string;
  name: string;
  description: string;
  load: () => Promise<{ default: ComponentType }>;
}

export const CALCS: CalcDef[] = [
  { id: 'exposure', index: '01', name: 'Exposure and ND', description: 'Solve the exposure triangle, ND filters, long exposures, EV table.', load: () => import('./calcs/ExposureCalc') },
  { id: 'dof', index: '02', name: 'Depth of field', description: 'Near and far limits, inverse solvers, circle of confusion.', load: () => import('./calcs/DofCalc') },
  { id: 'fov', index: '03', name: 'Field of view', description: 'Angles, scene size at distance, focal length needed, video crops.', load: () => import('./calcs/FovCalc') },
  { id: 'hyperfocal', index: '04', name: 'Hyperfocal table', description: 'Hyperfocal distances across apertures and focal lengths.', load: () => import('./calcs/HyperfocalCalc') },
  { id: 'subject', index: '05', name: 'Subject distance', description: 'Distance to frame a subject of a known size.', load: () => import('./calcs/SubjectDistanceCalc') },
  { id: 'shutter', index: '06', name: 'Shutter angle', description: 'The 180-degree rule at any frame rate, both directions.', load: () => import('./calcs/ShutterAngleCalc') },
  { id: 'framerate', index: '07', name: 'Frame rate and slow motion', description: 'Shooting vs playback fps, speed, recommended shutter.', load: () => import('./calcs/FrameRateCalc') },
  { id: 'timelapse', index: '08', name: 'Time lapse', description: 'Interval, shoot time, clip length, frames, storage and timer.', load: () => import('./calcs/TimelapseCalc') },
  { id: 'stars', index: '09', name: 'Stars and star trails', description: 'NPF and 500 rule exposure limits, trail length.', load: () => import('./calcs/StarsCalc') },
  { id: 'equivalence', index: '10', name: 'Lens equivalence', description: 'Equivalent focal length and aperture between sensors.', load: () => import('./calcs/EquivalenceCalc') },
  { id: 'light', index: '11', name: 'Light power and distance', description: 'Inverse-square law, stops gained or lost when a light moves.', load: () => import('./calcs/LightDistanceCalc') },
  { id: 'kelvin', index: '12', name: 'Colour temperature', description: 'Kelvin to mired, correction between sources, gel suggestions.', load: () => import('./calcs/ColourTempCalc') },
  { id: 'dollyzoom', index: '13', name: 'Dolly zoom', description: 'Distances and focal lengths that hold subject size.', load: () => import('./calcs/DollyZoomCalc') },
  { id: 'anamorphic', index: '14', name: 'Anamorphic', description: 'Squeeze factor, resulting aspect ratio, de-squeezed size.', load: () => import('./calcs/AnamorphicCalc') },
  { id: 'storage', index: '15', name: 'Storage and battery', description: 'Card capacity vs bitrate, minutes per card, battery runtime.', load: () => import('./calcs/StorageCalc') },
  { id: 'script', index: '16', name: 'Script to runtime', description: 'Page count to runtime and a rough shooting-day estimate.', load: () => import('./calcs/ScriptCalc') },
  { id: 'shadow', index: '17', name: 'Shadow length', description: 'Shadow cast by an object at a given sun elevation.', load: () => import('./calcs/ShadowCalc') },
  { id: 'timecode', index: '18', name: 'Timecode and frames', description: 'Add, subtract and convert timecode and frame counts.', load: () => import('./calcs/TimecodeCalc') },
];

export function calcById(id: string | undefined): CalcDef | undefined {
  return CALCS.find((c) => c.id === id);
}
