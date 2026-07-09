// Shared helpers for the EIA data pipeline: fuel taxonomy, largest-remainder
// rounding, and the pre-commit validation gate described in the plan (§2).

export const FUEL_ORDER = ['gas', 'coal', 'nuclear', 'wind', 'solar', 'hydro', 'other'];

// EIA `fueltypeid` -> display category. Pumped storage (HPS) is deliberately
// folded into "other" since it nets negative for many states.
export const FUEL_TYPE_MAP = {
  NG: 'gas',
  COW: 'coal',
  NUC: 'nuclear',
  WND: 'wind',
  SUN: 'solar',
  DPV: 'solar',
  HYC: 'hydro',
  PEL: 'other',
  PC: 'other',
  OOG: 'other',
  WWW: 'other',
  WAS: 'other',
  GEO: 'other',
  HPS: 'other',
  OTH: 'other',
};

export const STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

/** Largest-remainder rounding so displayed shares sum to exactly 1 (in 0.001 units). */
export function roundShares(mix) {
  const keys = Object.keys(mix).filter((k) => mix[k] > 0);
  const scale = 1000; // 3 decimals
  const raw = keys.map((k) => mix[k] * scale);
  const floors = raw.map(Math.floor);
  let used = floors.reduce((a, b) => a + b, 0);
  let remainder = scale - used;
  const order = keys
    .map((k, i) => ({ k, i, frac: raw[i] - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const result = {};
  keys.forEach((k, i) => (result[k] = floors[i]));
  for (let j = 0; j < remainder; j++) {
    const { k } = order[j % order.length];
    result[k] += 1;
  }
  const out = {};
  keys.forEach((k) => (out[k] = result[k] / scale));
  return out;
}

export function dominantFuel(mix) {
  let best = 'other';
  let bestVal = -Infinity;
  for (const k of FUEL_ORDER) {
    const v = mix[k] ?? 0;
    if (v > bestVal) {
      best = k;
      bestVal = v;
    }
  }
  return best;
}

/**
 * Validate the full energy.json artifact before it's allowed to be committed.
 * Throws with a descriptive message on the first failure (fail loudly, no partial deploy).
 */
export function validateEnergyData(data, previous) {
  const errors = [];

  if (!data.meta?.latestPeriod) errors.push('meta.latestPeriod missing');
  if (previous?.meta?.latestPeriod && data.meta.latestPeriod < previous.meta.latestPeriod) {
    errors.push(
      `latest period ${data.meta.latestPeriod} is older than previous artifact's ${previous.meta.latestPeriod}`
    );
  }

  const stateCodes = Object.keys(STATES);
  for (const code of stateCodes) {
    const rec = data.states[code];
    if (!rec) {
      errors.push(`missing jurisdiction: ${code}`);
      continue;
    }
    const sum = Object.values(rec.mix).reduce((a, b) => a + (b || 0), 0);
    if (Number.isNaN(sum)) errors.push(`${code}: mix contains NaN`);
    else if (Math.abs(sum - 1) > 0.005) errors.push(`${code}: shares sum to ${sum}, expected 1 ± 0.005`);
    for (const [fuel, share] of Object.entries(rec.mix)) {
      if (Number.isNaN(share)) errors.push(`${code}.${fuel} is NaN`);
      if (share < 0) errors.push(`${code}.${fuel} is negative after clamping: ${share}`);
    }
  }

  if (Object.keys(data.states).length !== 51) {
    errors.push(`expected 51 jurisdictions, found ${Object.keys(data.states).length}`);
  }

  if (errors.length) {
    throw new Error(`energy.json failed validation:\n  - ${errors.join('\n  - ')}`);
  }
  return true;
}
