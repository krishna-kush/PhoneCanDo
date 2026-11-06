// Calendar helpers on injected epoch-ms values (never the wall clock).

/** One day in milliseconds. */
export const DAY_MS = 86_400_000;

/** UTC calendar day of `ms` as YYYY-MM-DD. */
export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Start (00:00:00.000 UTC) of the UTC calendar day containing `ms`. */
export function utcDayStart(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}
