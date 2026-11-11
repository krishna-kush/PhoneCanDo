import { useCallback, useEffect, useState } from 'react';
import { canSetRunLimits, runLimits, setRunLimits, type RunLimits } from '../../../engine/runLimits';
import { usePageActive } from '../../nav/pageActive';

/**
 * The caps as native keeps them, read again whenever the page is in front,
 * and their save: the page shows what native kept. `failed` after a save
 * that did not land; `supported` false on a build without caps.
 */
export function useRunLimits() {
  const active = usePageActive();
  const [limits, setLimits] = useState<RunLimits>(runLimits);
  const [supported] = useState(canSetRunLimits);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (active) setLimits(runLimits());
  }, [active]);

  const save = useCallback((next: RunLimits) => {
    const kept = setRunLimits(next);
    setFailed(kept == null);
    if (kept) setLimits(kept);
  }, []);

  return { limits, save, supported, failed };
}
