// Analytics points are best effort: a failed write is logged and never turns
// a page view or a download redirect into an error.

import type { Logger } from './op.ts';
import type { TceResult } from './result.ts';

/** Run one point write; log a failure (or a throw from a buggy store) instead of propagating it. */
export async function writePointSafely(log: Logger, what: string, write: () => Promise<TceResult<void>>): Promise<boolean> {
  try {
    const r = await write();
    if (r.ok) return true;
    log.warn(`${what} point not written`, { code: r.error.code, message: r.error.message });
  } catch (e) {
    log.error(`${what} point write threw`, { error: e instanceof Error ? e.message : String(e) });
  }
  return false;
}
