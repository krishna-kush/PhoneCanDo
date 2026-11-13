// The night's minutes in words: the phone's clock and a stretch of time.
// Pure.

/** Minutes from 21:00 as the phone's clock: "02:40". */
export function clock(m: number): string {
  const h = (21 + Math.floor(m / 60)) % 24;
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** "2 h", "45 min", "1 h 20". */
export function span(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m}` : `${h} h`;
}
