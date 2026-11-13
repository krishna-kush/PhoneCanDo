import { useEffect, useState } from 'react';

/** How often "next in 12 min" moves on. */
const TICK_MS = 30_000;

/** Now, moved on every half minute while `on` (the page in front). */
export function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [on]);
  return now;
}
