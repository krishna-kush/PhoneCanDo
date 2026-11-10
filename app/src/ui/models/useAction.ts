import { useCallback, useState } from 'react';
import type { ActionResult } from '../../state/flows/modelActions';
import { modelErrorText } from './logic/errorText';

// One button's run of a model action: busy while it runs, its failure as a
// sentence after.
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (action: () => Promise<ActionResult>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const res = await action();
    setBusy(false);
    if (!res.ok) setError(modelErrorText(res.code, res.message));
    return res.ok;
  }, []);
  return { busy, error, run };
}
