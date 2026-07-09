import type { FuelKey } from './fuels';

export type FuelMix = Partial<Record<FuelKey, number>>;

export interface TrendPoint {
  p: string; // period, "YYYY-MM"
  mix: FuelMix;
  total: number;
}

export interface StateRecord {
  name: string;
  total: number; // GWh
  mix: FuelMix; // shares 0..1, sums to ~1
  dominant: FuelKey;
  yoy: {
    period: string;
    totalDelta: number;
    mixDelta: Partial<Record<FuelKey, number>>;
  } | null;
  trend13: TrendPoint[];
}

export interface EnergyData {
  meta: {
    latestPeriod: string;
    generatedAt: string;
    source: string;
    units: string;
    isSample?: boolean;
  };
  national: {
    total: number;
    mix: FuelMix;
    trend13: TrendPoint[];
    yoy: { period: string; totalDelta: number; mixDelta: Partial<Record<FuelKey, number>> } | null;
  };
  states: Record<string, StateRecord>;
}
