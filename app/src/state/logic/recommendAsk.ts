// When the "Having fun?" card asks, after an agent's run finished well in
// front of you. Not too often: never in the first days or before a few good
// runs, then at most once a fortnight; never again after you shared, said
// "Don't ask again", or said "Not now" three times. Pure (zero RN imports).

export type AskState = {
  /** When the app first counted (ms); the wait for MIN_AGE_MS starts there. */
  since: number | null;
  /** Runs that finished well, counted up to MIN_RUNS. */
  runs: number;
  /** When the card last showed (ms). */
  lastAskedAt: number | null;
  /** "Not now" taps so far. */
  notNow: number;
  /** Shared, or "Don't ask again": the card never shows again. */
  done: boolean;
};

export type Answer = 'share' | 'notNow' | 'never';

export const MIN_RUNS = 5;
export const MIN_AGE_MS = 2 * 24 * 60 * 60 * 1000;
export const GAP_MS = 14 * 24 * 60 * 60 * 1000;
export const MAX_NOT_NOW = 3;

export const FRESH: AskState = { since: null, runs: 0, lastAskedAt: null, notNow: 0, done: false };

/** The clock starts the first time the app counts. */
export function started(s: AskState, now: number): AskState {
  return s.since == null ? { ...s, since: now } : s;
}

/**
 * A run finished well: it counts, and the card asks when you were looking
 * at that chat and the rules allow it (which stamps lastAskedAt).
 */
export function runFinished(s: AskState, now: number, looking: boolean): { state: AskState; ask: boolean } {
  const counted = { ...started(s, now), runs: Math.min(s.runs + 1, MIN_RUNS) };
  if (!looking || !mayAsk(counted, now)) return { state: counted, ask: false };
  return { state: { ...counted, lastAskedAt: now }, ask: true };
}

function mayAsk(s: AskState, now: number): boolean {
  if (s.done || s.notNow >= MAX_NOT_NOW || s.runs < MIN_RUNS) return false;
  if (s.since == null || now - s.since < MIN_AGE_MS) return false;
  return s.lastAskedAt == null || now - s.lastAskedAt >= GAP_MS;
}

export function answered(s: AskState, answer: Answer): AskState {
  if (answer === 'notNow') return { ...s, notNow: s.notNow + 1 };
  return { ...s, done: true };
}

/** A stored state; anything unreadable starts fresh. */
export function parseAsk(raw: string | null): AskState {
  if (!raw) return FRESH;
  try {
    const o = JSON.parse(raw) as Partial<AskState>;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    return {
      since: num(o.since),
      runs: Math.max(0, Math.min(num(o.runs) ?? 0, MIN_RUNS)),
      lastAskedAt: num(o.lastAskedAt),
      notNow: Math.max(0, num(o.notNow) ?? 0),
      done: o.done === true,
    };
  } catch {
    return FRESH;
  }
}
