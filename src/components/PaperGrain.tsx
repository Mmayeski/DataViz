// Single subtle feTurbulence paper-grain filter, baked once as a static
// overlay — never animated, never regenerated (§1).
export function PaperGrain() {
  return (
    <svg className="paper-grain" aria-hidden="true" focusable="false">
      <filter id="paper-grain-filter">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.15  0 0 0 0 0.12  0 0 0 0.05 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#paper-grain-filter)" />
    </svg>
  );
}
