export function Methodology({ onClose }: { onClose: () => void }) {
  return (
    <div className="methodology-page notebook-page" role="dialog" aria-modal="true" aria-label="Methodology">
      <button className="close-button" onClick={onClose} aria-label="Close notebook">
        ✕
      </button>
      <h2 className="notebook-title">How this notebook is kept</h2>
      <div className="notebook-prose">
        <p>
          Every number here comes from EIA-923, the U.S. Energy Information Administration's monthly survey of power
          plants. Utilities file it roughly two months after the fact — surveys take time to ink — so "this month"
          on this notebook usually means the most recent month EIA has finished tallying, not the calendar month.
          We never call it live, because it isn't.
        </p>
        <p>
          "Other" folds together biomass, geothermal, petroleum, and pumped storage. Pumped storage is unusual: some
          months a state draws more power into storage than it releases, making its generation negative. We clamp
          the displayed share at zero but keep the true number in the underlying data.
        </p>
        <p>
          Solar includes both utility-scale plants and EIA's estimate of small-scale rooftop systems — leaving
          rooftop out would make sunny, suburban states look far less solar than they are.
        </p>
        <p>
          The map's cross-hatching is decorative — every figure it represents is also written out as plain text and
          numbers in each state's page, so the ink pattern is never the only way to read the data.
        </p>
        <p>
          Source:{' '}
          <a href="https://www.eia.gov/electricity/data/state/" target="_blank" rel="noreferrer">
            EIA electricity data by state
          </a>
          .
        </p>
      </div>
    </div>
  );
}
