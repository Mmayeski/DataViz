import { FUELS, type FuelKey } from './fuels';
import type { StateRecord, EnergyData } from './types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function monthName(period: string): string {
  const [, m] = period.split('-').map(Number);
  return MONTH_NAMES[m - 1] ?? period;
}

export function pct(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Deterministic template rule over the data — never generated prose (§8). */
export function surveyorSummary(code: string, rec: StateRecord, period: string): string {
  const month = monthName(period);
  const dominantLabel = FUELS[rec.dominant].label;
  const share = pct(rec.mix[rec.dominant] ?? 0);

  if (code === 'DC') {
    return `Washington D.C. imports nearly all of its power from the PJM grid — local generation shown below runs on ${dominantLabel.toLowerCase()}.`;
  }

  const verb = rec.dominant === 'wind' || rec.dominant === 'solar' || rec.dominant === 'hydro' ? 'runs on' : 'runs on';
  let line = `${rec.name} ${verb} ${dominantLabel.toLowerCase()} — ${share} of everything it generated in ${month}.`;

  if (rec.total < 3000) {
    line += ` (${rec.name}'s modest ${Math.round(rec.total).toLocaleString()} GWh that month.)`;
  }

  return line;
}

/** National annotation: the biggest YoY mover, rotates naturally as the data updates. */
export function nationalAnnotation(data: EnergyData): string {
  const yoy = data.national.yoy;
  if (!yoy) return 'The national mix, surveyed fresh this month.';
  const entries = Object.entries(yoy.mixDelta) as [FuelKey, number][];
  if (!entries.length) return 'The national mix held steady month over month.';
  const [fuel, delta] = entries.reduce((a, b) => (Math.abs(b[1]) > Math.abs(a[1]) ? b : a));
  const dir = delta >= 0 ? 'up' : 'down';
  const pts = Math.abs(Math.round(delta * 1000) / 10);
  const month = monthName(yoy.period);
  return `${FUELS[fuel].label} ${dir} ${pts} pts vs. last ${month}.`;
}

export function yoyArrow(delta: number | undefined): { symbol: string; label: string } {
  if (delta === undefined || Math.abs(delta) < 0.0005) return { symbol: '→', label: 'flat' };
  return delta > 0 ? { symbol: '↑', label: 'up' } : { symbol: '↓', label: 'down' };
}
