// Writes the queue and the settings to the StoragePort. Queue writes are
// debounced (errors and a session end are written at once), chained so they
// land in order, and held back until init() has loaded what is stored.
// Storage failures are logged, never thrown.

import type { ClientContext } from './context.ts';
import { describe } from './log.ts';
import { isIdle, serializeQueue } from './queue.ts';
import { STORAGE_KEYS } from './types.ts';

/**
 * Debounce for queue writes after a track or session update. Errors, and a
 * session update that carries endedAt (the app is leaving the foreground),
 * are written at once.
 */
export const PERSIST_DEBOUNCE_MS = 250;

// True once the queue as it is now is stored (or, idle or off, removed).
async function write(c: ClientContext): Promise<boolean> {
  try {
    if (!c.enabled || isIdle(c.queue)) await c.storage.removeItem(STORAGE_KEYS.queue);
    // Before this process opened a session, the stored pointer is kept.
    else await c.storage.setItem(STORAGE_KEYS.queue, serializeQueue(c.queue, c.lastOpenedId ?? c.previousId));
    return true;
  } catch (e) {
    c.log.warn('telemetry: could not persist the queue', { error: describe(e) });
    return false;
  }
}

/** Writes the queue now (a pending debounced write is folded in); true once it is in storage. */
export function persistNow(c: ClientContext): Promise<boolean> {
  // Writes are chained so they land in order; each one serializes the queue
  // as it is when it runs, so a burst collapses into the latest state.
  if (c.persistTimer !== null) {
    clearTimeout(c.persistTimer);
    c.persistTimer = null;
  }
  const run = c.writeChain.then(
    () => write(c),
    () => write(c),
  );
  c.writeChain = run.then(() => undefined);
  return run;
}

/** Asks for a queue write: after the debounce, at once when `immediate`, or once init() ran when it has not. */
export function schedulePersist(c: ClientContext, immediate = false): void {
  // Before init the stored queue is not loaded yet; writing would clobber it.
  if (!c.ready) {
    c.persistWanted = true;
    return;
  }
  if (immediate) {
    void persistNow(c);
    return;
  }
  if (c.persistTimer !== null) return;
  c.persistTimer = setTimeout(() => {
    c.persistTimer = null;
    void persistNow(c);
  }, PERSIST_DEBOUNCE_MS);
}

/** Stores one setting; a failure is logged. */
export async function setFlag(c: ClientContext, key: string, value: string): Promise<void> {
  try {
    await c.storage.setItem(key, value);
  } catch (e) {
    c.log.warn('telemetry: could not store a setting', { key, error: describe(e) });
  }
}
