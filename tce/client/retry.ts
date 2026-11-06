// Retry policy after a failed send: exponential backoff from BACKOFF_BASE_MS
// up to BACKOFF_MAX_MS, stretched to the server's Retry-After when that asks
// for longer. Pure; flush.ts keeps the failure count and the retry time.

/** First retry delay after a retryable failure; doubles per failure. */
export const BACKOFF_BASE_MS = 30_000;
/** Longest retry delay. */
export const BACKOFF_MAX_MS = 60 * 60_000;
/** Longest Retry-After honoured; a longer one (or a broken header) waits this long. */
export const RETRY_AFTER_MAX_MS = 24 * 60 * 60_000;

/** Wait before the next attempt after `failures` consecutive retryable failures. */
export function backoffDelay(failures: number): number {
  if (failures <= 0) return 0;
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.min(failures - 1, 20));
}

/**
 * Wait before the next attempt: the backoff, or the server's Retry-After
 * when that is longer (capped at RETRY_AFTER_MAX_MS).
 */
export function retryDelay(failures: number, retryAfterMs: number | null): number {
  const backoff = backoffDelay(failures);
  if (retryAfterMs === null || !(retryAfterMs > 0)) return backoff;
  return Math.max(backoff, Math.min(retryAfterMs, RETRY_AFTER_MAX_MS));
}
