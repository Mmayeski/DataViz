import rough from 'roughjs/bin/rough';
import type { StateGeo } from './geo';
import { FUELS, type FuelKey } from './fuels';
import type { EnergyData } from './types';

// A detached SVG element purely so rough.js has an ownerDocument to create
// nodes against — it is never inserted into the page itself.
const detachedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const generator = rough.svg(detachedSvg as unknown as SVGSVGElement);

/** Stable numeric seed per state (+ optional variant) so the ink wobble never changes between renders. */
function seedFor(code: string, variant = ''): number {
  const str = code + variant;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 2147483647 || 1;
}

/** Only the top 3 fuels at ≥8% share get hachure layers — below that it's noise at mobile sizes (§3). */
export function topFuelLayers(mix: Partial<Record<FuelKey, number>>): { fuel: FuelKey; share: number }[] {
  return (Object.entries(mix) as [FuelKey, number][])
    .filter(([, share]) => share >= 0.08)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([fuel, share]) => ({ fuel, share }));
}

/** Higher share -> denser hachure (smaller gap between strokes). */
function gapForShare(share: number): number {
  return Math.max(2.5, 13 - share * 16);
}

export function buildStateInk(state: StateGeo, mix: Partial<Record<FuelKey, number>> | null): SVGGElement {
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.setAttribute('data-state', state.code);
  g.setAttribute('class', 'state-ink');

  const layers = mix ? topFuelLayers(mix) : [];
  for (const { fuel, share } of layers) {
    const spec = FUELS[fuel];
    const fill = generator.path(state.d, {
      fill: spec.color,
      fillStyle: spec.fillStyle,
      hachureAngle: spec.angle,
      hachureGap: gapForShare(share),
      fillWeight: 1.35,
      stroke: 'none',
      seed: seedFor(state.code, fuel),
      roughness: 1.1,
    });
    fill.setAttribute('class', `hachure hachure-${fuel}`);
    g.appendChild(fill);
  }

  const border = generator.path(state.d, {
    stroke: 'var(--ink)',
    strokeWidth: 1.25,
    roughness: 1.0,
    bowing: 0.6,
    fill: 'none',
    seed: seedFor(state.code, 'border'),
  });
  border.setAttribute('class', 'state-border');
  border
    .querySelectorAll('path')
    .forEach((p) => p.setAttribute('style', 'vector-effect: non-scaling-stroke'));
  g.appendChild(border);

  return g;
}

export function buildAllStateInk(states: StateGeo[], data: EnergyData): Map<string, SVGGElement> {
  const map = new Map<string, SVGGElement>();
  for (const s of states) {
    const rec = data.states[s.code];
    map.set(s.code, buildStateInk(s, rec?.mix ?? null));
  }
  return map;
}

/** Single-fuel lens: density mapped 0%->blank paper, 60%+->dense hatch, per §4. */
export function buildLensInk(states: StateGeo[], data: EnergyData, fuel: FuelKey): Map<string, SVGGElement> {
  const spec = FUELS[fuel];
  const map = new Map<string, SVGGElement>();
  for (const s of states) {
    const rec = data.states[s.code];
    const share = rec?.mix[fuel] ?? 0;
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-state', s.code);
    g.setAttribute('class', 'state-ink');

    if (share > 0.005) {
      const fill = generator.path(s.d, {
        fill: spec.color,
        fillStyle: spec.fillStyle,
        hachureAngle: spec.angle,
        hachureGap: gapForShare(Math.min(share, 0.6)),
        fillWeight: 1.35,
        stroke: 'none',
        seed: seedFor(s.code, `lens-${fuel}`),
        roughness: 1.1,
      });
      fill.setAttribute('class', `hachure hachure-${fuel}`);
      g.appendChild(fill);
    }

    const border = generator.path(s.d, {
      stroke: 'var(--ink)',
      strokeWidth: 1.25,
      roughness: 1.0,
      bowing: 0.6,
      fill: 'none',
      seed: seedFor(s.code, 'border'),
    });
    border.setAttribute('class', 'state-border');
    border
      .querySelectorAll('path')
      .forEach((p) => p.setAttribute('style', 'vector-effect: non-scaling-stroke'));
    g.appendChild(border);

    map.set(s.code, g);
  }
  return map;
}
