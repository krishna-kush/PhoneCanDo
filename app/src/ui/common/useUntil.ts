import { useEffect, useState } from 'react';

/** True until `at` (ms since the epoch) has passed, drawing again once then; false for null or a time gone by. */
export function useUntil(at: number | null): boolean {
  const [, passed] = useState(0);
  const waiting = at != null && Date.now() < at;
  useEffect(() => {
    if (at == null) return;
    const ms = at - Date.now();
    if (ms <= 0) return;
    const timer = setTimeout(() => passed((n) => n + 1), ms);
    return () => clearTimeout(timer);
  }, [at]);
  return waiting;
}
