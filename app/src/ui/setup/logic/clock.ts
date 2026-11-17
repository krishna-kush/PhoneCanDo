// The setup screen's arcade clock and which tip shows. Pure (zero RN
// imports).

/** Elapsed time as an arcade's clock: "00:07", "01:32". */
export function clock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** The tip showing [ms] into the setup, a new one every [every] ms, round again after the last. */
export function tipAt(ms: number, every: number, count: number): number {
  if (count <= 0) return 0;
  return Math.floor(Math.max(0, ms) / every) % count;
}
