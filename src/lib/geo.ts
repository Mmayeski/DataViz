import { geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import topology from 'us-atlas/states-albers-10m.json';
import { FIPS_TO_USPS } from './fips';

export interface StateGeo {
  code: string; // USPS
  d: string; // pre-projected SVG path (states-albers-10m ships pixel-space coords already)
  centroid: [number, number];
  bounds: [[number, number], [number, number]];
}

// states-albers-10m.json ships coordinates already projected into a ~975x610
// pixel box (AK/HI insets baked in, per the plan's geometry note) — geoPath
// with no projection just traces them straight through as planar points.
const path = geoPath();

export function loadStateGeometry(): StateGeo[] {
  const collection = feature(topology as any, (topology as any).objects.states) as any;
  const out: StateGeo[] = [];
  for (const f of collection.features) {
    const fips = String(f.id).padStart(2, '0');
    const code = FIPS_TO_USPS[fips];
    if (!code) continue; // territories etc. not part of the 50+DC set
    const d = path(f as any);
    if (!d) continue;
    out.push({
      code,
      d,
      centroid: path.centroid(f as any) as [number, number],
      bounds: path.bounds(f as any) as [[number, number], [number, number]],
    });
  }
  return out;
}

export const MAP_VIEWBOX = { width: 975, height: 610 };

// DC is far too small to tap on the base map — plan calls for a hand-drawn
// callout chip off the mid-Atlantic coast connected by a leader line.
export const DC_CALLOUT = {
  anchor: [828, 267] as [number, number], // DC's true centroid in the albers projection
  chip: [900, 330] as [number, number], // callout chip center, floating off the coast
};
