import { useEffect, useRef } from 'react';
import rough from 'roughjs/bin/rough';
import { FUELS, FUEL_ORDER, type FuelKey } from '../lib/fuels';
import type { TrendPoint } from '../lib/types';

const detachedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const gen = rough.svg(detachedSvg as unknown as SVGSVGElement);

const W = 130;
const H = 40;
const PAD = 4;

function Sparkline({ fuel, trend }: { fuel: FuelKey; trend: TrendPoint[] }) {
  const gRef = useRef<SVGGElement | null>(null);
  const values = trend.map((t) => t.mix[fuel] ?? 0);
  const max = Math.max(...values, 0.01);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    g.innerHTML = '';
    const points: [number, number][] = values.map((v, i) => [
      PAD + (i / (values.length - 1)) * (W - PAD * 2),
      H - PAD - (v / max) * (H - PAD * 2),
    ]);
    const line = gen.curve(points, {
      stroke: FUELS[fuel].color,
      strokeWidth: 2,
      roughness: 0.9,
      seed: fuel.charCodeAt(0) + fuel.length,
    });
    g.appendChild(line);
  }, [fuel, trend]);

  const latestShare = values[values.length - 1] ?? 0;
  if (latestShare < 0.01 && Math.max(...values) < 0.01) return null;

  return (
    <div className="sparkline">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${FUELS[fuel].label} share over the last 13 months, currently ${Math.round(latestShare * 100)}%`}>
        <g ref={gRef} />
      </svg>
      <span className="sparkline-label">{FUELS[fuel].label}</span>
    </div>
  );
}

export function Sparklines({ trend }: { trend: TrendPoint[] }) {
  if (trend.length < 2) return null;
  return (
    <div className="sparklines">
      {FUEL_ORDER.map((fuel) => (
        <Sparkline key={fuel} fuel={fuel} trend={trend} />
      ))}
    </div>
  );
}
