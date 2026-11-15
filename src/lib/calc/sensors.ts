export interface Sensor {
  id: string;
  name: string;
  width: number; // mm
  height: number; // mm
  crop: number; // relative to full frame diagonal
  pixelPitch?: number; // microns (typical body)
  group: 'preset' | 'custom';
}

export const FULL_FRAME_DIAGONAL = Math.hypot(36, 24);

export function cropFactor(width: number, height: number): number {
  return FULL_FRAME_DIAGONAL / Math.hypot(width, height);
}

export const SENSORS: Sensor[] = [
  { id: 'canon-r50v', name: 'Canon EOS R50V (APS-C)', width: 22.3, height: 14.9, crop: 1.6, pixelPitch: 3.72, group: 'preset' },
  { id: 'full-frame', name: 'Full frame', width: 36, height: 24, crop: 1, pixelPitch: 4.3, group: 'preset' },
  { id: 'super35', name: 'Super 35', width: 24.89, height: 18.66, crop: 1.39, pixelPitch: 5.5, group: 'preset' },
  { id: 'mft', name: 'Micro Four Thirds', width: 17.3, height: 13, crop: 2.0, pixelPitch: 3.3, group: 'preset' },
  { id: 'one-inch', name: '1-inch', width: 13.2, height: 8.8, crop: 2.7, pixelPitch: 2.4, group: 'preset' },
  { id: 'fuji-apsc', name: 'Fujifilm APS-C', width: 23.5, height: 15.6, crop: 1.53, pixelPitch: 3.0, group: 'preset' },
  { id: 'c70-s35', name: 'Canon Super 35 (DGO)', width: 26.2, height: 13.8, crop: 1.45, pixelPitch: 6.4, group: 'preset' },
  { id: 'bmd-s35', name: 'Blackmagic Super 35', width: 23.1, height: 12.99, crop: 1.56, pixelPitch: 3.8, group: 'preset' },
  { id: 'bmd-mft', name: 'Blackmagic 4/3', width: 18.96, height: 10, crop: 2.0, pixelPitch: 4.6, group: 'preset' },
];

export function getSensor(id: string, custom?: { width: number; height: number; name: string }): Sensor {
  if (id === 'custom' && custom) {
    return {
      id: 'custom',
      name: custom.name || 'Custom sensor',
      width: custom.width,
      height: custom.height,
      crop: cropFactor(custom.width, custom.height),
      group: 'custom',
    };
  }
  return SENSORS.find((s) => s.id === id) ?? SENSORS[1];
}

/** Circle of confusion by the common d/1500 rule, where d is the sensor diagonal. */
export function circleOfConfusion(sensor: Pick<Sensor, 'width' | 'height'>): number {
  return Math.hypot(sensor.width, sensor.height) / 1500;
}

export const COMMON_APERTURES = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
export const COMMON_FOCALS = [14, 18, 24, 35, 50, 85, 100, 135, 200];
