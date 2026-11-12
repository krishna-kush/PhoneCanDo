import { useEffect, useState } from 'react';
import { lastScriptLog } from '../../../engine/linux/native';
import type { ScriptLog } from '../../../engine/linux/types';
import { linuxFailureText } from '../logic/errorText';

export type LastInstallLog =
  | { state: 'reading' }
  /** No install or update ran in this machine yet. */
  | { state: 'none' }
  | { state: 'failed'; message: string }
  | { state: 'read'; log: ScriptLog };

// The end of the last install or update log in the agent's machine, read
// once when the page opens.
export function useLastInstallLog(imageId: string | null): LastInstallLog {
  const [result, setResult] = useState<LastInstallLog>({ state: 'reading' });

  useEffect(() => {
    if (!imageId) return;
    let live = true;
    setResult({ state: 'reading' });
    lastScriptLog(imageId).then(
      (log) => {
        if (live) setResult(log ? { state: 'read', log } : { state: 'none' });
      },
      (e: unknown) => {
        if (live) setResult({ state: 'failed', message: linuxFailureText(e) });
      },
    );
    return () => {
      live = false;
    };
  }, [imageId]);

  return result;
}
