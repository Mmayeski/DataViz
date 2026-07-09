import { MixBar } from './MixBar';
import { FUELS, FUEL_ORDER, type FuelKey } from '../lib/fuels';
import { pct, yoyArrow, nationalAnnotation } from '../lib/copy';
import type { EnergyData } from '../lib/types';

export function NationalPanel({ data, reducedMotion }: { data: EnergyData; reducedMotion: boolean }) {
  const { mix, total, yoy } = data.national;
  const rows = FUEL_ORDER.filter((k) => (mix[k] ?? 0) > 0);

  return (
    <div className="national-panel">
      <h2 className="notebook-subtitle">National ledger</h2>
      <p className="annotation">{nationalAnnotation(data)}</p>
      <MixBar mix={mix} width={320} animate={!reducedMotion} />
      <table className="ledger">
        <caption className="visually-hidden">National generation mix</caption>
        <thead>
          <tr>
            <th scope="col">Fuel</th>
            <th scope="col">Share</th>
            <th scope="col">YoY</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((fuel) => {
            const delta = yoy?.mixDelta[fuel as FuelKey];
            const arrow = yoyArrow(delta);
            return (
              <tr key={fuel}>
                <th scope="row">
                  <span className="swatch" style={{ background: FUELS[fuel].color }} aria-hidden="true" />
                  {FUELS[fuel].label}
                </th>
                <td>{pct(mix[fuel] ?? 0)}</td>
                <td className={`yoy yoy--${arrow.label}`}>
                  {arrow.symbol}
                  {delta !== undefined ? ` ${Math.abs(Math.round(delta * 1000) / 10)}` : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="national-total">Total surveyed: {total.toLocaleString()} GWh</p>
    </div>
  );
}
