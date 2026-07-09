export type FuelKey = 'gas' | 'coal' | 'nuclear' | 'wind' | 'solar' | 'hydro' | 'other';

export const FUEL_ORDER: FuelKey[] = ['gas', 'coal', 'nuclear', 'wind', 'solar', 'hydro', 'other'];

export interface FuelSpec {
  key: FuelKey;
  label: string;
  color: string;
  /** Hachure stroke angle in degrees. */
  angle: number;
  /** rough.js fillStyle for this fuel's texture. */
  fillStyle: 'hachure' | 'zigzag' | 'dots' | 'cross-hatch';
}

export const FUELS: Record<FuelKey, FuelSpec> = {
  gas: { key: 'gas', label: 'Natural gas', color: '#C98A3D', angle: 45, fillStyle: 'hachure' },
  coal: { key: 'coal', label: 'Coal', color: '#4A4A48', angle: 135, fillStyle: 'cross-hatch' },
  nuclear: { key: 'nuclear', label: 'Nuclear', color: '#7D6B9E', angle: 90, fillStyle: 'hachure' },
  wind: { key: 'wind', label: 'Wind', color: '#7FA6B5', angle: 10, fillStyle: 'hachure' },
  solar: { key: 'solar', label: 'Solar', color: '#E0A526', angle: 60, fillStyle: 'zigzag' },
  hydro: { key: 'hydro', label: 'Hydro', color: '#5B7F9E', angle: 20, fillStyle: 'hachure' },
  other: { key: 'other', label: 'Other', color: '#8C9B7A', angle: 90, fillStyle: 'dots' },
};
