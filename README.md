# The Grid Notebook

A hand-drawn, mobile-first atlas of America's electricity mix. Every state is
cross-hatched in the pigments of the fuels that power it — natural gas in
amber ochre, coal in graphite, wind in sky slate — so the map itself is the
legend. Tap a state to open its notebook page: a mix bar, a ledger, and a
13-month sparkline, all sourced from EIA's monthly generation survey
(Form EIA-923) and stamped honestly with the month it was surveyed.

It's a fully static site with a build-time data pipeline — no servers, no
runtime API calls.

## Stack

Vite + React + TypeScript, `d3-geo`/`d3-zoom`/`topojson-client` for the
`us-atlas` geography, and `rough.js` for every hand-drawn shape (map hachure,
mix bars, sparklines). No chart library, no CSS framework.

## Running locally

```bash
npm install
npm run dev
```

## Data pipeline

`public/data/energy.json` is a single static artifact — the app never calls
the EIA API at runtime.

- `npm run generate-sample` — regenerates a placeholder fixture (approximate,
  clearly marked `meta.isSample: true`) from `pipeline/state-baselines.mjs`.
  This is what ships until the real pipeline runs.
- `npm run fetch-data` — pulls real monthly net generation by state and fuel
  type from the EIA API v2 (`electric-power-operational-data`, the surface
  for EIA-923). Requires an `EIA_API_KEY` environment variable — register a
  free key at https://www.eia.gov/opendata/register.php.

Both scripts write the same schema and run through the same validation gate
in `pipeline/lib.mjs` (51 jurisdictions present, shares sum to 100% ± 0.5,
no NaNs, latest period never regresses) before anything is written.

`.github/workflows/refresh.yml` runs `fetch.mjs` weekly against the
`EIA_API_KEY` repo secret and commits `energy.json` only when it changes,
which triggers a normal static redeploy.

## Deploying

Any static host works (Vercel, Netlify, GitHub Pages). Build with
`npm run build`, publish `dist/`. Set the `EIA_API_KEY` repo secret so the
scheduled workflow can keep the data current — until then, the site runs on
the sample fixture and says so in the stamp.

## Project structure

```
pipeline/
  lib.mjs                 → fuel taxonomy, rounding, validation gate
  fetch.mjs               → real EIA API v2 pull
  generate-sample.mjs     → placeholder fixture generator
  state-baselines.mjs     → approximate mix table used only by the sample
src/
  components/             → GridMap, BottomSheet, MixBar, Ledger, Sparklines, ...
  lib/                    → geo/topojson helpers, rough.js baking, copy rules
  styles/                 → design tokens + layout
public/
  data/energy.json        → the one data artifact the app fetches
  fonts/                  → self-hosted Architects Daughter, Karla, Spline Sans Mono
```
