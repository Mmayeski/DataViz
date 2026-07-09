import { useEffect, useRef } from 'react';
import rough from 'roughjs/bin/rough';
import { FUELS, FUEL_ORDER, type FuelKey } from '../lib/fuels';
import { pct } from '../lib/copy';
import type { FuelMix } from '../lib/types';

const detachedSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const gen = rough.svg(detachedSvg as unknown as SVGSVGElement);

interface MixBarProps {
  mix: FuelMix;
  width?: number;
  height?: number;
  animate?: boolean;
}

interface Segment {
  fuel: FuelKey;
  share: number;
  x: number;
  width: number;
}

const MIN_LABEL_SHARE = 0.04;

function buildSegments(mix: FuelMix, width: number): Segment[] {
  const entries = FUEL_ORDER.map((k) => [k, mix[k] ?? 0] as [FuelKey, number]).filter(([, v]) => v > 0);
  let x = 0;
  const segs: Segment[] = [];
  for (const [fuel, share] of entries) {
    const w = share * width;
    segs.push({ fuel, share, x, width: w });
    x += w;
  }
  return segs;
}

export function MixBar({ mix, width = 320, height = 40, animate = true }: MixBarProps) {
  const gRef = useRef<SVGGElement | null>(null);
  const segments = buildSegments(mix, width);

  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    g.innerHTML = '';
    for (const seg of segments) {
      if (seg.width < 0.5) continue;
      const spec = FUELS[seg.fuel];
      const rect = gen.rectangle(seg.x, 0, seg.width, height, {
        fill: spec.color,
        fillStyle: spec.fillStyle,
        hachureAngle: spec.angle,
        hachureGap: 3,
        fillWeight: 1.2,
        stroke: 'var(--ink)',
        strokeWidth: 1.1,
        roughness: 1.1,
        seed: Math.round(seg.x * 13) + 1,
      });
      rect.setAttribute('data-fuel', seg.fuel);
      g.appendChild(rect);
    }

    // The bar draws in left-to-right once, ~400ms (§1 motion) — a clip-path
    // reveal rather than re-running rough.js, so the ink itself never redraws.
    if (animate) {
      g.style.transition = 'none';
      g.style.clipPath = `inset(0 ${width}px 0 0)`;
      g.getBoundingClientRect(); // force a reflow so the hidden state actually paints first
      g.style.transition = 'clip-path 400ms ease-out';
      g.style.clipPath = 'inset(0 0 0 0)';
    } else {
      g.style.transition = 'none';
      g.style.clipPath = 'inset(0 0 0 0)';
    }
  }, [mix, width, height, animate]);

  return (
    <div className="mix-bar" style={{ width }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        className={animate ? 'mix-bar-draw' : ''}
        role="img"
        aria-label={segments.map((s) => `${FUELS[s.fuel].label} ${pct(s.share)}`).join(', ')}
      >
        <g ref={gRef} />
      </svg>
      <div className="mix-bar-labels">
        {segments
          .filter((s) => s.share >= MIN_LABEL_SHARE)
          .map((s) => (
            <span key={s.fuel} className="mix-bar-label" style={{ flexBasis: `${s.share * 100}%` }}>
              <span className="swatch" style={{ background: FUELS[s.fuel].color }} aria-hidden="true" />
              {FUELS[s.fuel].label} {pct(s.share)}
            </span>
          ))}
      </div>
    </div>
  );
}
