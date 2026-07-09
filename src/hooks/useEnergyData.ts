import { useEffect, useState } from 'react';
import type { EnergyData } from '../lib/types';

type Status = { state: 'loading' } | { state: 'ready'; data: EnergyData } | { state: 'error'; message: string };

export function useEnergyData(): Status {
  const [status, setStatus] = useState<Status>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetch('/data/energy.json')
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: EnergyData) => {
        if (!cancelled) setStatus({ state: 'ready', data });
      })
      .catch((err) => {
        if (!cancelled) setStatus({ state: 'error', message: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
