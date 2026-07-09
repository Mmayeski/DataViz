#!/usr/bin/env node
// Produces a placeholder public/data/energy.json from the approximate
// baselines in state-baselines.mjs, with synthetic seasonal variation so the
// sparklines and YoY deltas have something to show. This stands in for
// pipeline/fetch.mjs until EIA_API_KEY is configured — the schema is
// identical, and meta.isSample marks it so the UI can be honest about it.

import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES, FUEL_ORDER, roundShares, dominantFuel, validateEnergyData } from './lib.mjs';
import { STATE_BASELINES } from './state-baselines.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'energy.json');

const LATEST_PERIOD = '2026-05'; // ~2-month EIA publication lag behind today's date

function periodsEndingAt(latest, count) {
  const [y, m] = latest.split('-').map(Number);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

// Deterministic pseudo-random so re-runs are stable (no seed drift between builds).
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function monthIndex(period) {
  return Number(period.split('-')[1]);
}

/** Seasonal multiplier by fuel: solar peaks in summer, hydro in spring melt, wind in spring/fall. */
function seasonalFactor(fuel, month) {
  const rad = (month - 1) * (Math.PI / 6);
  switch (fuel) {
    case 'solar':
      return 1 + 0.35 * Math.sin(rad - Math.PI / 2 + Math.PI); // peak ~July
    case 'hydro':
      return 1 + 0.30 * Math.sin(rad - Math.PI / 3); // peak spring melt
    case 'wind':
      return 1 + 0.15 * Math.cos(rad); // peak spring/fall
    case 'gas':
      return 1 + 0.12 * Math.abs(Math.cos(rad)); // peaks summer + winter (AC + heating backup)
    default:
      return 1;
  }
}

function buildTrend(code, baseline, periods, rand) {
  const trend = periods.map((p) => {
    const month = monthIndex(p);
    const noise = 1 + (rand() - 0.5) * 0.06;
    const weighted = {};
    for (const fuel of FUEL_ORDER) {
      const base = baseline.mix[fuel];
      if (!base) continue;
      weighted[fuel] = base * seasonalFactor(fuel, month) * (1 + (rand() - 0.5) * 0.08);
    }
    const total = Math.round(baseline.total * noise);
    const weightedSum = Object.values(weighted).reduce((a, b) => a + b, 0);
    const normalized = Object.fromEntries(Object.entries(weighted).map(([k, v]) => [k, v / weightedSum]));
    const mix = roundShares(normalized);
    return { p, mix, total };
  });
  return trend;
}

function withYoy(trend, latestPeriod) {
  const latest = trend[trend.length - 1];
  const yoyIndex = trend.length - 13;
  const yoyPoint = yoyIndex >= 0 ? trend[yoyIndex] : null;
  if (!yoyPoint) return null;
  const mixDelta = {};
  for (const k of FUEL_ORDER) {
    const d = (latest.mix[k] ?? 0) - (yoyPoint.mix[k] ?? 0);
    if (Math.abs(d) >= 0.001) mixDelta[k] = Math.round(d * 1000) / 1000;
  }
  return {
    period: yoyPoint.p,
    totalDelta: Math.round(((latest.total - yoyPoint.total) / yoyPoint.total) * 1000) / 1000,
    mixDelta,
  };
}

async function main() {
  const periods = periodsEndingAt(LATEST_PERIOD, 25); // extra year of history so YoY has a comparison point
  const recentPeriods = periods.slice(-13);

  const states = {};
  for (const code of Object.keys(STATES)) {
    const baseline = STATE_BASELINES[code];
    const rand = seededRandom(code.charCodeAt(0) * 1000 + code.charCodeAt(1));
    const fullTrend = buildTrend(code, baseline, periods, rand);
    const trend13 = fullTrend.slice(-13);
    const latest = trend13[trend13.length - 1];
    states[code] = {
      name: STATES[code],
      total: latest.total,
      mix: latest.mix,
      dominant: dominantFuel(latest.mix),
      yoy: withYoy(fullTrend, LATEST_PERIOD),
      trend13,
    };
  }

  const nationalTrend = recentPeriods.map((p) => {
    const agg = {};
    let total = 0;
    for (const code of Object.keys(STATES)) {
      const pt = states[code].trend13.find((t) => t.p === p);
      total += pt.total;
      for (const [k, share] of Object.entries(pt.mix)) {
        agg[k] = (agg[k] ?? 0) + share * pt.total;
      }
    }
    const mix = roundShares(Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, v / total])));
    return { p, mix, total: Math.round(total) };
  });
  const latestNational = nationalTrend[nationalTrend.length - 1];
  const yoyNational = nationalTrend.length >= 13
    ? (() => {
        const prior = nationalTrend[nationalTrend.length - 13];
        const mixDelta = {};
        for (const k of FUEL_ORDER) {
          const d = (latestNational.mix[k] ?? 0) - (prior.mix[k] ?? 0);
          if (Math.abs(d) >= 0.001) mixDelta[k] = Math.round(d * 1000) / 1000;
        }
        return {
          period: prior.p,
          totalDelta: Math.round(((latestNational.total - prior.total) / prior.total) * 1000) / 1000,
          mixDelta,
        };
      })()
    : null;

  const data = {
    meta: {
      latestPeriod: LATEST_PERIOD,
      generatedAt: new Date().toISOString(),
      source: 'EIA API v2, electric-power-operational-data (Form EIA-923) — SAMPLE FIXTURE, not live EIA data',
      units: 'GWh',
      isSample: true,
    },
    national: {
      total: latestNational.total,
      mix: latestNational.mix,
      trend13: nationalTrend,
      yoy: yoyNational,
    },
    states,
  };

  validateEnergyData(data, null);
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote sample fixture to ${OUT_PATH} (latest period ${LATEST_PERIOD}).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
