/* Media storage, bitrate and battery. GB are decimal (1000 MB) as card makers rate them. */

export function gbPerHour(mbps: number): number {
  return (mbps * 3600) / 8 / 1000;
}

export function gbPerMinute(mbps: number): number {
  return gbPerHour(mbps) / 60;
}

export function minutesOnCard(cardGb: number, mbps: number): number {
  return (cardGb * 1000 * 8) / mbps / 60;
}

export function cardsNeeded(hoursOfFootage: number, mbps: number, cardGb: number): number {
  return Math.ceil((gbPerHour(mbps) * hoursOfFootage) / cardGb);
}

export interface CodecPreset {
  name: string;
  mbps: number;
}

/** Typical nominal bitrates. Always check your camera's menu for the exact figure. */
export const CODEC_PRESETS: CodecPreset[] = [
  { name: 'HD 25p H.264 IPB', mbps: 28 },
  { name: 'HD 50p H.264 IPB', mbps: 60 },
  { name: '4K 25p H.264/H.265 IPB', mbps: 120 },
  { name: '4K 50p H.264/H.265 IPB', mbps: 230 },
  { name: '4K 25p ALL-I', mbps: 470 },
  { name: '4K ProRes 422 25p', mbps: 471 },
  { name: '4K ProRes 422 HQ 25p', mbps: 707 },
  { name: '4K ProRes RAW 25p', mbps: 1100 },
  { name: '6K RAW 25p', mbps: 1500 },
];

export interface BatteryResult {
  wh: number;
  minutesPerBattery: number;
  totalMinutes: number;
  batteriesForShoot: number;
}

export function battery(capacityMah: number, voltage: number, drawWatts: number, batteryCount: number, shootHours: number): BatteryResult {
  const wh = (capacityMah / 1000) * voltage;
  const minutesPerBattery = (wh / drawWatts) * 60;
  return {
    wh,
    minutesPerBattery,
    totalMinutes: minutesPerBattery * batteryCount,
    batteriesForShoot: Math.ceil((shootHours * 60) / minutesPerBattery),
  };
}
