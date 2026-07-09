#!/usr/bin/env node
// Pulls monthly net generation by state and fuel type from the EIA API v2
// (electric-power-operational-data, the API surface for Form EIA-923),
// reshapes it into public/data/energy.json, and validates before writing.
//
// Requires EIA_API_KEY in the environment. Register at
// https://www.eia.gov/opendata/register.php

import { writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUEL_TYPE_MAP, STATES, FUEL_ORDER, roundShares, dominantFuel, validateEnergyData } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'public', 'data', 'energy.json');

const API_KEY = process.env.EIA_API_KEY;
const BASE = 'https://api.eia.gov/v2/electricity/electric-power-operational-data/data/';
const MONTHS_BACK = 13;

function periodsBack(n) {
  const out = [];
  const d = new Date();
  d.setUTCDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out.reverse();
}

async function fetchAllPages(params) {
  const rows = [];
  let offset = 0;
  const length = 5000;
  for (;;) {
    const url = new URL(BASE);
    url.searchParams.set('api_key', API_KEY);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('length', String(length));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`EIA API ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const batch = json.response?.data ?? [];
    rows.push(...batch);
    if (batch.length < length) break;
    offset += length;
  }
  return rows;
}

async function fetchGeneration(startPeriod, endPeriod) {
  return fetchAllPages({
    frequency: 'monthly',
    'data[0]': 'generation',
    'facets[sectorid][]': '99',
    start: startPeriod,
    end: endPeriod,
    'sort[0][column]': 'period',
    'sort[0][direction]': 'asc',
  });
}

/** Reshape raw EIA rows into { period: { stateCode: { fuelKey: MWh } } } plus residual reconciliation. */
function reshape(rows) {
  const byPeriodState = {};
  for (const row of rows) {
    const period = row.period;
    const state = row.location; // EIA uses 2-letter state codes for `location` on this route
    if (!STATES[state]) continue; // skip regional/US aggregates
    const category = FUEL_TYPE_MAP[row.fueltypeid];
    if (!category) continue; // ALL, and any aggregate fueltypeids, are skipped — we sum named categories instead
    const gen = Number(row.generation) || 0; // thousand MWh per EIA units on this route

    byPeriodState[period] ??= {};
    byPeriodState[period][state] ??= {};
    byPeriodState[period][state][category] = (byPeriodState[period][state][category] ?? 0) + gen;
  }
  return byPeriodState;
}

function buildStateRecord(code, byPeriodState, periods) {
  const latest = periods[periods.length - 1];
  const latestFuels = byPeriodState[latest]?.[code] ?? {};

  const totalRaw = Object.values(latestFuels).reduce((a, b) => a + b, 0);
  // Pumped storage and similar can be negative; clamp only the *displayed* share, keep truth via totalRaw.
  const clamped = {};
  for (const k of FUEL_ORDER) clamped[k] = Math.max(0, latestFuels[k] ?? 0);
  const clampedTotal = Object.values(clamped).reduce((a, b) => a + b, 0) || 1;
  const mix = roundShares(
    Object.fromEntries(FUEL_ORDER.map((k) => [k, clamped[k] / clampedTotal]).filter(([, v]) => v > 0))
  );

  const trend13 = periods.map((p) => {
    const fuels = byPeriodState[p]?.[code] ?? {};
    const clampedP = {};
    for (const k of FUEL_ORDER) clampedP[k] = Math.max(0, fuels[k] ?? 0);
    const totalP = Object.values(clampedP).reduce((a, b) => a + b, 0) || 1;
    const mixP = roundShares(
      Object.fromEntries(FUEL_ORDER.map((k) => [k, clampedP[k] / totalP]).filter(([, v]) => v > 0))
    );
    return { p, mix: mixP, total: Math.round(totalP) };
  });

  const yoyPeriod = shiftPeriod(latest, -12);
  const yoyPoint = trend13.find((t) => t.p === yoyPeriod);
  let yoy = null;
  if (yoyPoint) {
    const mixDelta = {};
    for (const k of FUEL_ORDER) {
      const d = (mix[k] ?? 0) - (yoyPoint.mix[k] ?? 0);
      if (Math.abs(d) >= 0.001) mixDelta[k] = Math.round(d * 1000) / 1000;
    }
    yoy = {
      period: yoyPeriod,
      totalDelta: yoyPoint.total > 0 ? Math.round(((clampedTotal - yoyPoint.total) / yoyPoint.total) * 1000) / 1000 : 0,
      mixDelta,
    };
  }

  return {
    name: STATES[code],
    total: Math.round(clampedTotal),
    mix,
    dominant: dominantFuel(mix),
    yoy,
    trend13,
  };
}

function shiftPeriod(period, months) {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function main() {
  if (!API_KEY) {
    console.error('EIA_API_KEY is not set. Register at https://www.eia.gov/opendata/register.php');
    process.exit(1);
  }

  const periods = periodsBack(MONTHS_BACK + 12); // extra 12 months so YoY has a comparison point
  const start = periods[0];
  const end = periods[periods.length - 1];

  console.log(`Fetching EIA generation data ${start}..${end}...`);
  const rows = await fetchGeneration(start, end);
  console.log(`Fetched ${rows.length} rows.`);

  const byPeriodState = reshape(rows);
  const recentPeriods = periods.slice(-MONTHS_BACK);
  const latestPeriod = recentPeriods[recentPeriods.length - 1];

  const states = {};
  for (const code of Object.keys(STATES)) {
    states[code] = buildStateRecord(code, byPeriodState, recentPeriods);
  }

  // National aggregate: sum of all states per period.
  const nationalTrend = recentPeriods.map((p) => {
    const agg = {};
    let total = 0;
    for (const code of Object.keys(STATES)) {
      const pt = states[code].trend13.find((t) => t.p === p);
      if (!pt) continue;
      total += pt.total;
      for (const [k, share] of Object.entries(pt.mix)) {
        agg[k] = (agg[k] ?? 0) + share * pt.total;
      }
    }
    const mix = roundShares(Object.fromEntries(Object.entries(agg).map(([k, v]) => [k, v / (total || 1)])));
    return { p, mix, total: Math.round(total) };
  });
  const latestNational = nationalTrend[nationalTrend.length - 1];
  const yoyNationalPeriod = shiftPeriod(latestPeriod, -12);
  const yoyNationalPoint = nationalTrend.find((t) => t.p === yoyNationalPeriod);
  const nationalYoy = yoyNationalPoint
    ? {
        period: yoyNationalPeriod,
        totalDelta: Math.round(((latestNational.total - yoyNationalPoint.total) / yoyNationalPoint.total) * 1000) / 1000,
        mixDelta: Object.fromEntries(
          FUEL_ORDER.map((k) => [k, Math.round(((latestNational.mix[k] ?? 0) - (yoyNationalPoint.mix[k] ?? 0)) * 1000) / 1000]).filter(
            ([, v]) => Math.abs(v) >= 0.001
          )
        ),
      }
    : null;

  const data = {
    meta: {
      latestPeriod,
      generatedAt: new Date().toISOString(),
      source: 'EIA API v2, electric-power-operational-data (Form EIA-923)',
      units: 'GWh',
    },
    national: {
      total: latestNational.total,
      mix: latestNational.mix,
      trend13: nationalTrend,
      yoy: nationalYoy,
    },
    states,
  };

  let previous = null;
  if (existsSync(OUT_PATH)) {
    try {
      previous = JSON.parse(await readFile(OUT_PATH, 'utf-8'));
    } catch {
      previous = null;
    }
  }

  validateEnergyData(data, previous);

  if (previous && previous.meta.latestPeriod === data.meta.latestPeriod) {
    console.log('No new data since last run (same latest period). Skipping write.');
    return;
  }

  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + '\n');
  console.log(`Wrote ${OUT_PATH} — latest period ${latestPeriod}, ${Object.keys(states).length} jurisdictions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
