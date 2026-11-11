import { useEffect, useState } from 'react';
import { secondsLeft } from './logic/memoryCopy';

/** Whole seconds until `stopAt`, re-rendering once a second while there is a countdown; null without one. */
export function useCountdown(stopAt: number | null): number | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (stopAt == null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [stopAt]);
  return secondsLeft(stopAt, Date.now());
}
