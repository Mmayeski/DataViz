import { useEffect, useMemo, useRef } from 'react';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent } from 'd3-zoom';
import rough from 'roughjs/bin/rough';
import { loadStateGeometry, MAP_VIEWBOX, DC_CALLOUT, type StateGeo } from '../lib/geo';
import { SMALL_TAP_TARGET_STATES } from '../lib/fips';
import { buildAllStateInk, buildLensInk } from '../lib/roughMap';
import { FUELS, type FuelKey } from '../lib/fuels';
import type { EnergyData } from '../lib/types';
import { pct } from '../lib/copy';

interface GridMapProps {
  data: EnergyData;
  fuelLens: FuelKey | 'all';
  selectedState: string | null;
  onSelectState: (code: string | null) => void;
  reducedMotion: boolean;
}

function hitRadius(state: StateGeo): number {
  const [[x0, y0], [x1, y1]] = state.bounds;
  const base = Math.min(x1 - x0, y1 - y0) / 2;
  const boosted = SMALL_TAP_TARGET_STATES.has(state.code) ? Math.max(base, 11) : base;
  return Math.min(Math.max(boosted * 0.85, 8), 42);
}

const detachedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const calloutGen = rough.svg(detachedSvg as unknown as SVGSVGElement);

export function GridMap({ data, fuelLens, selectedState, onSelectState, reducedMotion }: GridMapProps) {
  const geometries = useMemo(() => loadStateGeometry(), []);
  const geoByCode = useMemo(() => new Map(geometries.map((g) => [g.code, g])), [geometries]);
  const alphaOrder = useMemo(
    () =>
      [...geometries]
        .filter((g) => g.code !== 'DC')
        .concat(geoByCode.has('DC') ? [geoByCode.get('DC')!] : [])
        .map((g) => g.code)
        .sort((a, b) => (data.states[a]?.name ?? a).localeCompare(data.states[b]?.name ?? b)),
    [geometries, data, geoByCode]
  );

  const svgRef = useRef<SVGSVGElement | null>(null);
  const zoomGroupRef = useRef<SVGGElement | null>(null);
  const inkLayerRef = useRef<SVGGElement | null>(null);
  const calloutLayerRef = useRef<SVGGElement | null>(null);
  const hitRefs = useRef(new Map<string, SVGCircleElement>());
  const hasPlayedIntro = useRef(false);

  // Pan/zoom: transform-only, never touches the ink paths (§4 60fps requirement).
  useEffect(() => {
    if (!svgRef.current || !zoomGroupRef.current) return;
    const zoomGroup = zoomGroupRef.current;
    const behavior = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 8])
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        zoomGroup.setAttribute('transform', event.transform.toString());
      });
    const sel = select(svgRef.current);
    sel.call(behavior).call(behavior.transform, zoomIdentity);
    return () => {
      sel.on('.zoom', null);
    };
  }, []);

  // Build (or rebuild on fuel-lens change) the decorative hachure ink layer.
  useEffect(() => {
    const layer = inkLayerRef.current;
    if (!layer) return;

    const inkMap = fuelLens === 'all' ? buildAllStateInk(geometries, data) : buildLensInk(geometries, data, fuelLens);

    const applyNew = () => {
      layer.innerHTML = '';
      for (const code of alphaOrder) {
        const g = inkMap.get(code);
        if (g) layer.appendChild(g);
      }
      if (!hasPlayedIntro.current) {
        hasPlayedIntro.current = true;
        playIntroAnimation(layer, geometries, reducedMotion);
      }
    };

    if (!hasPlayedIntro.current || reducedMotion) {
      applyNew();
    } else {
      layer.style.transition = `opacity ${125}ms ease-out`;
      layer.style.opacity = '0';
      const t = setTimeout(() => {
        applyNew();
        requestAnimationFrame(() => {
          layer.style.opacity = '1';
        });
      }, 125);
      return () => clearTimeout(t);
    }
  }, [data, fuelLens, geometries, alphaOrder, reducedMotion]);

  // The DC callout: a hand-drawn leader line + chip, standing in for a
  // polygon far too small to tap (§3).
  useEffect(() => {
    const layer = calloutLayerRef.current;
    if (!layer) return;
    layer.innerHTML = '';
    const [ax, ay] = DC_CALLOUT.anchor;
    const [cx, cy] = DC_CALLOUT.chip;

    const leader = calloutGen.line(ax, ay, cx, cy, {
      stroke: 'var(--ink-faint-solid, #22271F)',
      strokeWidth: 1,
      roughness: 1.4,
      seed: 42,
    });
    leader.setAttribute('opacity', '0.55');
    layer.appendChild(leader);

    const dcMix = data.states.DC?.mix ?? {};
    const dominant = data.states.DC?.dominant;
    const chipCircle = calloutGen.circle(cx, cy, 46, {
      fill: dominant ? FUELS[dominant].color : '#F7F3E8',
      fillStyle: 'hachure',
      hachureGap: 3,
      stroke: 'var(--ink)',
      strokeWidth: 1.4,
      roughness: 1.2,
      seed: 43,
    });
    layer.appendChild(chipCircle);
  }, [data]);

  function playIntroAnimation(layer: SVGGElement, states: StateGeo[], skip: boolean) {
    const borders = layer.querySelectorAll<SVGPathElement>('.state-border path');
    if (skip) return;
    const xs = states.map((s) => (s.bounds[0][0] + s.bounds[1][0]) / 2);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const span = maxX - minX || 1;

    borders.forEach((path) => {
      const parentG = path.closest('[data-state]') as SVGGElement | null;
      const code = parentG?.getAttribute('data-state');
      const state = code ? states.find((s) => s.code === code) : undefined;
      const length = path.getTotalLength();
      const x = state ? (state.bounds[0][0] + state.bounds[1][0]) / 2 : minX;
      const delay = ((x - minX) / span) * 700;
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.style.transition = 'none';
      requestAnimationFrame(() => {
        path.style.transition = `stroke-dashoffset 520ms ease-out ${delay}ms`;
        path.style.strokeDashoffset = '0';
      });
    });
  }

  function focusState(code: string) {
    hitRefs.current.get(code)?.focus();
  }

  function moveFocus(code: string, dir: 1 | -1) {
    const idx = alphaOrder.indexOf(code);
    const next = alphaOrder[(idx + dir + alphaOrder.length) % alphaOrder.length];
    focusState(next);
  }

  return (
    <svg
      ref={svgRef}
      className="grid-map"
      viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
      role="group"
      aria-label="Map of the United States, hatched by electricity fuel mix"
      style={{ touchAction: 'none' }}
    >
      <g ref={zoomGroupRef} style={{ willChange: 'transform' }}>
        <rect
          x={-200}
          y={-200}
          width={MAP_VIEWBOX.width + 400}
          height={MAP_VIEWBOX.height + 400}
          fill="var(--paper)"
          onClick={() => onSelectState(null)}
          aria-hidden="true"
        />
        <g ref={inkLayerRef} className="ink-layer" style={{ pointerEvents: 'none' }} />
        <g aria-hidden="true">
          {geometries
            .filter((s) => s.code !== 'DC')
            .map((s) => {
              const rec = data.states[s.code];
              const isSelected = selectedState === s.code;
              return (
                <circle
                  key={s.code}
                  ref={(el) => {
                    if (el) hitRefs.current.set(s.code, el);
                  }}
                  data-state={s.code}
                  cx={s.centroid[0]}
                  cy={s.centroid[1]}
                  r={hitRadius(s)}
                  className={`state-hit${isSelected ? ' state-hit--selected' : ''}`}
                  fill="transparent"
                  tabIndex={0}
                  role="button"
                  aria-label={
                    rec ? `${rec.name} — ${pct(rec.mix[rec.dominant] ?? 0)} ${FUELS[rec.dominant].label.toLowerCase()}, tap for details` : s.code
                  }
                  onClick={() => onSelectState(s.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectState(s.code);
                    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                      e.preventDefault();
                      moveFocus(s.code, 1);
                    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      moveFocus(s.code, -1);
                    } else if (e.key === 'Escape') {
                      onSelectState(null);
                    }
                  }}
                />
              );
            })}
        </g>
        <g ref={calloutLayerRef} />
        {geoByCode.has('DC') && (
          <g>
            <circle
              ref={(el) => {
                if (el) hitRefs.current.set('DC', el);
              }}
              data-state="DC"
              cx={DC_CALLOUT.chip[0]}
              cy={DC_CALLOUT.chip[1]}
              r={26}
              fill="transparent"
              tabIndex={0}
              role="button"
              aria-label={
                data.states.DC
                  ? `Washington D.C. — ${pct(data.states.DC.mix[data.states.DC.dominant] ?? 0)} ${FUELS[data.states.DC.dominant].label.toLowerCase()}, tap for details`
                  : 'District of Columbia'
              }
              onClick={() => onSelectState('DC')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectState('DC');
                } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  moveFocus('DC', 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  moveFocus('DC', -1);
                } else if (e.key === 'Escape') {
                  onSelectState(null);
                }
              }}
            />
            <text
              x={DC_CALLOUT.chip[0]}
              y={DC_CALLOUT.chip[1] + 4}
              textAnchor="middle"
              className="dc-label"
              aria-hidden="true"
            >
              D.C.
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}
