import { useEffect, useRef, useState } from 'react';

/** How often the clock moves. */
const TICK_MS = 1000;

// Time since the setup screen showed, in ms, ticking each second while
// [running]; it stops where it is once the setup ends or fails.
export function useElapsed(running: boolean): number {
  const start = useRef(Date.now());
  const [now, setNow] = useState(start.current);
  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [running]);
  return now - start.current;
}
