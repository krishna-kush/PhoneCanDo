import { useEffect, useState } from 'react';
import { type ModelServerLog, modelServerLog } from '../../../engine/models/serverLog';

export type ModelServerLogRead =
  | { state: 'reading' }
  /** Its server never ran. */
  | { state: 'none' }
  | { state: 'failed' }
  | { state: 'read'; log: ModelServerLog };

// How often the log is read again while the model is loaded.
const LIVE_MS = 2000;

// The end of the model's server log, read when the page opens and, while
// the model is loaded ([live]), every LIVE_MS; a read that finds the log
// as it was (same size and time) draws nothing new.
export function useModelServerLog(modelId: string, live: boolean): ModelServerLogRead {
  const [result, setResult] = useState<ModelServerLogRead>({ state: 'reading' });

  useEffect(() => {
    let alive = true;
    const read = () =>
      modelServerLog(modelId).then(
        (log) => {
          if (!alive) return;
          setResult((prev) => {
            if (!log) return { state: 'none' };
            const same = prev.state === 'read' && prev.log.size === log.size && prev.log.modifiedAt === log.modifiedAt;
            return same ? prev : { state: 'read', log };
          });
        },
        () => {
          if (alive) setResult({ state: 'failed' });
        },
      );
    void read();
    const timer = live ? setInterval(() => void read(), LIVE_MS) : null;
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
    };
  }, [modelId, live]);

  return result;
}
