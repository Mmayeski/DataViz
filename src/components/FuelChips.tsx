import { FUELS, FUEL_ORDER, type FuelKey } from '../lib/fuels';

interface FuelChipsProps {
  value: FuelKey | 'all';
  onChange: (value: FuelKey | 'all') => void;
}

export function FuelChips({ value, onChange }: FuelChipsProps) {
  return (
    <div className="fuel-chips" role="radiogroup" aria-label="Fuel lens">
      <button
        className={`chip${value === 'all' ? ' chip--active' : ''}`}
        role="radio"
        aria-checked={value === 'all'}
        onClick={() => onChange('all')}
      >
        All
      </button>
      {FUEL_ORDER.map((fuel) => (
        <button
          key={fuel}
          className={`chip${value === fuel ? ' chip--active' : ''}`}
          role="radio"
          aria-checked={value === fuel}
          onClick={() => onChange(fuel)}
        >
          <span className="swatch" style={{ background: FUELS[fuel].color }} aria-hidden="true" />
          {FUELS[fuel].label}
        </button>
      ))}
    </div>
  );
}
