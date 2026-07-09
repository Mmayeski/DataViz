import { useEffect, useState } from 'react';
import { GridMap } from './components/GridMap';
import { FuelChips } from './components/FuelChips';
import { NationalPanel } from './components/NationalPanel';
import { BottomSheet } from './components/BottomSheet';
import { Methodology } from './components/Methodology';
import { Stamp } from './components/Stamp';
import { PaperGrain } from './components/PaperGrain';
import { useEnergyData } from './hooks/useEnergyData';
import { useReducedMotion } from './hooks/useReducedMotion';
import type { FuelKey } from './lib/fuels';

export default function App() {
  const status = useEnergyData();
  const reducedMotion = useReducedMotion();

  const [fuelLens, setFuelLens] = useState<FuelKey | 'all'>('all');
  const [selectedState, setSelectedState] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('state')
  );
  const [compareState, setCompareState] = useState<string | null>(null);
  const [isPickingCompare, setIsPickingCompare] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedState) url.searchParams.set('state', selectedState);
    else url.searchParams.delete('state');
    window.history.replaceState({}, '', url);
  }, [selectedState]);

  function handleSelectState(code: string | null) {
    if (isPickingCompare && code && code !== selectedState) {
      setCompareState(code);
      setIsPickingCompare(false);
      return;
    }
    setSelectedState(code);
    setCompareState(null);
    setIsPickingCompare(false);
  }

  if (status.state === 'loading') {
    return (
      <div className="load-state">
        <p>Uncapping the fountain pen…</p>
      </div>
    );
  }

  if (status.state === 'error') {
    return (
      <div className="load-state">
        <p>The ink hasn't dried on this month's data yet.</p>
        <p className="load-state-detail">Couldn't load the survey data. Try refreshing the page.</p>
      </div>
    );
  }

  const { data } = status;

  return (
    <div className="app">
      <PaperGrain />

      <header className="app-header">
        <h1 className="app-title">The Grid Notebook</h1>
        <button
          className="methodology-button"
          aria-label="About this notebook's methodology"
          onClick={() => setShowMethodology(true)}
        >
          ?
        </button>
      </header>

      <div className="stamp-row">
        <Stamp period={data.meta.latestPeriod} isSample={data.meta.isSample} />
      </div>

      <div className="map-wrap">
        <GridMap
          data={data}
          fuelLens={fuelLens}
          selectedState={selectedState}
          onSelectState={handleSelectState}
          reducedMotion={reducedMotion}
        />
      </div>

      <FuelChips value={fuelLens} onChange={setFuelLens} />

      <main className="content-area">
        {!selectedState && <NationalPanel data={data} reducedMotion={reducedMotion} />}
      </main>

      {selectedState && data.states[selectedState] && (
        <BottomSheet
          data={data}
          stateCode={selectedState}
          compareCode={compareState}
          isPickingCompare={isPickingCompare}
          onStartCompare={() => setIsPickingCompare(true)}
          onClearCompare={() => setCompareState(null)}
          onClose={() => {
            setSelectedState(null);
            setCompareState(null);
            setIsPickingCompare(false);
          }}
          onOpenMethodology={() => setShowMethodology(true)}
          reducedMotion={reducedMotion}
        />
      )}

      {showMethodology && <Methodology onClose={() => setShowMethodology(false)} />}
    </div>
  );
}
