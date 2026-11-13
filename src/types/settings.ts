export type Units = 'metric' | 'imperial';
export type Theme = 'light' | 'dark';
export type TimeFormat = '24h' | '12h';

export interface Location {
  name: string;
  lat: number;
  lng: number;
}

export interface Settings {
  units: Units;
  theme: Theme;
  timeFormat: TimeFormat;
  defaultSensorId: string;
  defaultFocalLength: number;
  defaultAperture: number;
  location: Location;
  timezone: string;
  onboardingDone: boolean;
  firstRunAt: number;
}

export const DEFAULT_LOCATION: Location = {
  name: 'Canberra',
  lat: -35.2809,
  lng: 149.13,
};

export const DEFAULT_SETTINGS: Settings = {
  units: 'metric',
  theme: 'light',
  timeFormat: '24h',
  defaultSensorId: 'canon-r50v',
  defaultFocalLength: 35,
  defaultAperture: 2.8,
  location: DEFAULT_LOCATION,
  timezone: 'Australia/Sydney',
  onboardingDone: false,
  firstRunAt: 0,
};
