import { monthName } from '../lib/copy';

export function Stamp({ period, isSample, compact = false }: { period: string; isSample?: boolean; compact?: boolean }) {
  const [year] = period.split('-');
  const label = isSample
    ? 'SAMPLE DATA · PIPELINE NOT YET RUN'
    : `SURVEYED · ${monthName(period).toUpperCase()} ${year} · EIA-923`;
  return <div className={`stamp${compact ? ' stamp--compact' : ''}`}>{label}</div>;
}
