// Upkeep of what this device holds in memory: the queue cap (warned about
// once per fill-up), the window of recent events kept for report(), and
// wiping all of it.

import { LIMITS } from '../core/schema/limits.ts';
import type { EventWire } from '../core/schema/wire.ts';
import { currentId, type ClientContext } from './context.ts';
import { emptyQueue, enforceCap } from './queue.ts';

/** Drops the oldest items over the cap (never the current session); warns once until a batch is delivered. */
export function capQueue(c: ClientContext): void {
  const dropped = enforceCap(c.queue, c.cap, currentId(c));
  if (dropped > 0 && !c.capWarned) {
    c.capWarned = true;
    c.log.warn('telemetry: queue full, dropping the oldest items', { cap: c.cap, dropped });
  }
}

/** Keeps a tracked event among the last LIMITS.reportEvents, sent or not, for report(). */
export function remember(c: ClientContext, ev: EventWire): void {
  c.recent.push(ev);
  if (c.recent.length > LIMITS.reportEvents) c.recent.splice(0, c.recent.length - LIMITS.reportEvents);
}

/** Forgets the queue, the recent events, the retry state and the cap warning. */
export function wipeLocal(c: ClientContext): void {
  c.queue = emptyQueue();
  c.recent = [];
  c.failures = 0;
  c.retryAt = 0;
  c.capWarned = false;
}
