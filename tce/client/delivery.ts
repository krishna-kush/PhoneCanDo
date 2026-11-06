// Pure queue bookkeeping around a send: repair what a wrong device clock
// stamped before a flush plans its batches, and settle exactly what a batch
// carried once the server has answered it.

import type { BatchPlan } from './batch.ts';
import { pruneSessions, type QueueState } from './queue.ts';
import { isEpochMs } from './sanitize.ts';

/**
 * Drops events and errors stamped outside the accepted time range and
 * re-dates sessions with a bad start or end; returns how many items it
 * dropped. `at` is the start time for a session with no good item.
 */
export function repairTimes(queue: QueueState, at: number): number {
  // Items stamped while the device clock was wrong can never be accepted
  // (the server rejects the whole batch over one bad time), so they are
  // dropped; a session with a bad start time is re-dated to its earliest
  // good item, or to now.
  const before = queue.events.length + queue.errors.length;
  queue.events = queue.events.filter((e) => isEpochMs(e.ts));
  queue.errors = queue.errors.filter((e) => isEpochMs(e.ts));
  const dropped = before - queue.events.length - queue.errors.length;
  for (const s of queue.sessions) {
    const badStart = !isEpochMs(s.wire.startedAt);
    const badEnd = s.wire.endedAt !== undefined && !isEpochMs(s.wire.endedAt);
    if (!badStart && !badEnd) continue;
    const next = { ...s.wire };
    if (badStart) {
      let first = at;
      for (const item of [...queue.events, ...queue.errors]) {
        if (item.sessionId === s.wire.sessionId && item.ts < first) first = item.ts;
      }
      next.startedAt = first;
    }
    if (badEnd) delete next.endedAt;
    s.wire = next;
    s.dirty = true;
    s.rev++;
  }
  return dropped;
}

/**
 * Removes exactly what a plan carried. A session stays dirty when it
 * changed while its request was in flight (its rev moved past `revs`).
 */
export function settle(queue: QueueState, plan: BatchPlan, revs: ReadonlyMap<string, number>, currentId: string | null): void {
  const events = new Set(plan.events);
  const errors = new Set(plan.errors);
  queue.events = queue.events.filter((e) => !events.has(e));
  queue.errors = queue.errors.filter((e) => !errors.has(e));
  for (const w of plan.sessions) {
    const rec = queue.sessions.find((s) => s.wire.sessionId === w.sessionId);
    if (rec && rec.rev === revs.get(w.sessionId)) rec.dirty = false;
  }
  pruneSessions(queue, currentId);
}
