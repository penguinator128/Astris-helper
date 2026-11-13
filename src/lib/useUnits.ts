import { useCallback } from 'react';
import { useSettings } from '@/store/settings';
import { fmtLength, fromDisplayLength, lengthUnit, toDisplayLength } from './format';
import type { Units } from '@/types/settings';

export interface UnitsApi {
  units: Units;
  unit: string;
  fmt: (metres: number, decimals?: number) => string;
  toDisplay: (metres: number) => number;
  fromDisplay: (v: number) => number;
}

export function useUnits(): UnitsApi {
  const units = useSettings((s) => s.units);
  const fmt = useCallback((m: number, d?: number) => fmtLength(m, units, d), [units]);
  const toDisplay = useCallback((m: number) => toDisplayLength(m, units), [units]);
  const fromDisplay = useCallback((v: number) => fromDisplayLength(v, units), [units]);
  return { units, unit: lengthUnit(units), fmt, toDisplay, fromDisplay };
}
