import { FUELS, FUEL_ORDER, type FuelKey } from '../lib/fuels';
import { pct, yoyArrow } from '../lib/copy';
import type { StateRecord } from '../lib/types';

interface LedgerProps {
  record: StateRecord;
  /** When set, rows always render (even at 0%) so two ledgers align in compare mode. */
  forceAllRows?: boolean;
}

export function Ledger({ record, forceAllRows = false }: LedgerProps) {
  const rows = FUEL_ORDER.filter((k) => forceAllRows || (record.mix[k] ?? 0) > 0);

  return (
    <table className="ledger">
      <caption className="visually-hidden">Generation mix ledger for {record.name}</caption>
      <thead>
        <tr>
          <th scope="col">Fuel</th>
          <th scope="col">GWh</th>
          <th scope="col">Share</th>
          <th scope="col">YoY</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((fuel) => {
          const share = record.mix[fuel] ?? 0;
          const gwh = Math.round(share * record.total);
          const delta = record.yoy?.mixDelta[fuel as FuelKey];
          const arrow = yoyArrow(delta);
          return (
            <tr key={fuel}>
              <th scope="row">
                <span className="swatch" style={{ background: FUELS[fuel].color }} aria-hidden="true" />
                {FUELS[fuel].label}
              </th>
              <td>{gwh.toLocaleString()}</td>
              <td>{pct(share)}</td>
              <td className={`yoy yoy--${arrow.label}`}>
                {arrow.symbol}
                {delta !== undefined ? ` ${Math.abs(Math.round(delta * 1000) / 10)}` : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
