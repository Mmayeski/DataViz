import { useRef, useState } from 'react';
import { MixBar } from './MixBar';
import { Ledger } from './Ledger';
import { Sparklines } from './Sparklines';
import { Stamp } from './Stamp';
import { surveyorSummary } from '../lib/copy';
import type { EnergyData } from '../lib/types';

type Snap = 'peek' | 'full';

interface BottomSheetProps {
  data: EnergyData;
  stateCode: string;
  compareCode: string | null;
  isPickingCompare: boolean;
  onStartCompare: () => void;
  onClearCompare: () => void;
  onClose: () => void;
  onOpenMethodology: () => void;
  reducedMotion: boolean;
}

export function BottomSheet({
  data,
  stateCode,
  compareCode,
  isPickingCompare,
  onStartCompare,
  onClearCompare,
  onClose,
  onOpenMethodology,
  reducedMotion,
}: BottomSheetProps) {
  const [snap, setSnap] = useState<Snap>('peek');
  const dragRef = useRef<{ startY: number; startSnap: Snap } | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const record = data.states[stateCode];
  const compareRecord = compareCode ? data.states[compareCode] : null;
  if (!record) return null;

  function onHandlePointerDown(e: React.PointerEvent) {
    dragRef.current = { startY: e.clientY, startSnap: snap };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current || !sheetRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    sheetRef.current.style.transition = 'none';
    sheetRef.current.style.transform = `translateY(${Math.max(0, dy)}px)`;
  }

  function onHandlePointerUp(e: React.PointerEvent) {
    if (!dragRef.current || !sheetRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    sheetRef.current.style.transition = '';
    sheetRef.current.style.transform = '';
    if (dy > 140) {
      onClose();
    } else if (dy > 40) {
      setSnap('peek');
    } else if (dy < -40) {
      setSnap('full');
    }
    dragRef.current = null;
  }

  return (
    <div
      ref={sheetRef}
      className={`notebook-sheet notebook-page snap--${snap}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${record.name} notebook page`}
    >
      <div
        className="sheet-handle"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onClick={() => setSnap((s) => (s === 'peek' ? 'full' : 'peek'))}
      >
        <span className="sheet-handle-bar" aria-hidden="true" />
      </div>

      <div className="sheet-scroll">
        <header className="sheet-header">
          <h2 className="notebook-title">{record.name}</h2>
          <p className="surveyor-line">{surveyorSummary(stateCode, record, data.meta.latestPeriod)}</p>
        </header>

        <section aria-label="Generation mix">
          <MixBar mix={record.mix} width={Math.min(340, 320)} animate={!reducedMotion} />
        </section>

        <section aria-label="Ledger">
          <Ledger record={record} forceAllRows={!!compareRecord} />
        </section>

        {compareRecord && (
          <section aria-label={`Compare with ${compareRecord.name}`} className="compare-panel">
            <h3 className="notebook-subtitle">{compareRecord.name}</h3>
            <MixBar mix={compareRecord.mix} width={Math.min(340, 320)} animate={!reducedMotion} />
            <Ledger record={compareRecord} forceAllRows />
          </section>
        )}

        <section aria-label="13-month trend">
          <h3 className="notebook-subtitle">Last 13 months</h3>
          <Sparklines trend={record.trend13} />
        </section>

        <div className="sheet-actions">
          {!compareRecord ? (
            <button className="ink-button" onClick={onStartCompare}>
              {isPickingCompare ? 'Tap a second state…' : 'Compare another state'}
            </button>
          ) : (
            <button className="ink-button" onClick={onClearCompare}>
              Clear comparison
            </button>
          )}
          <button className="ink-button" onClick={onClose}>
            Close notebook
          </button>
        </div>

        <footer className="sheet-footer">
          <button className="stamp-button" onClick={onOpenMethodology}>
            <Stamp period={data.meta.latestPeriod} isSample={data.meta.isSample} compact />
          </button>
        </footer>
      </div>
    </div>
  );
}
