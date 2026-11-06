// flush(): sends the queue as one or more batches, one flush at a time. A
// flush stops before its next batch once what it planned must not be sent
// any more (turned off, a new install id, forget), backs off after a
// retryable failure and drops a batch only on the server's own final
// rejection.

import { err, ok, type TceResult } from '../core/result.ts';
import type { BatchResponse, ErrorWire, EventWire } from '../core/schema/wire.ts';
import { planBatches, toRequest } from './batch.ts';
import { currentId, newUuid, now, type ClientContext } from './context.ts';
import { repairTimes, settle } from './delivery.ts';
import { postJson } from './http.ts';
import { envelope } from './identity.ts';
import { init } from './init.ts';
import { describe } from './log.ts';
import { schedulePersist } from './persistence.ts';
import { isIdle } from './queue.ts';
import { foreignBody, readBatchResponse } from './responses.ts';
import { retryDelay } from './retry.ts';
import { isEpochMs } from './sanitize.ts';

// True when a flush that started at `since` must not send another batch.
function stale(c: ClientContext, since: number): boolean {
  return since !== c.epoch || !c.enabled || c.forgetting || c.resetting > 0;
}

/** Resolves once no flush is running. inflight never rejects. */
export async function flushIdle(c: ClientContext): Promise<void> {
  while (c.inflight) await c.inflight;
}

async function doFlush(c: ClientContext): Promise<TceResult<BatchResponse> | null> {
  try {
    await init(c);
    const since = c.epoch;
    if (stale(c, since) || isIdle(c.queue)) return null;
    const started = now(c);
    if (started < c.retryAt) {
      return err('unavailable', `backing off for ${Math.ceil((c.retryAt - started) / 1000)} s`);
    }
    // A clock outside 2000..2200 would get every batch rejected: keep the
    // queue and try again on a later flush.
    if (!isEpochMs(started)) {
      c.log.warn('telemetry: device clock out of range; not sending', { now: started });
      return err('unavailable', 'device clock is out of range');
    }
    const envR = await envelope(c);
    if (!envR.ok) return envR;
    if (stale(c, since)) return null;
    const dropped = repairTimes(c.queue, started);
    if (dropped > 0) c.log.warn('telemetry: dropped items stamped by a wrong clock', { dropped });
    if (isIdle(c.queue)) return null;

    const sessions = new Map(c.queue.sessions.map((s) => [s.wire.sessionId, s.wire] as const));
    const revs = new Map(c.queue.sessions.map((s) => [s.wire.sessionId, s.rev] as const));
    const dirty = c.queue.sessions.filter((s) => s.dirty).map((s) => s.wire.sessionId);
    const { plans, oversized } = planBatches(envR.value, { sessions, dirty, events: c.queue.events, errors: c.queue.errors });
    if (oversized.length > 0) {
      const drop = new Set<EventWire | ErrorWire>(oversized);
      c.queue.events = c.queue.events.filter((e) => !drop.has(e));
      c.queue.errors = c.queue.errors.filter((e) => !drop.has(e));
      c.log.warn('telemetry: dropped items too large for any batch', { count: oversized.length });
    }

    const accepted = { sessions: 0, events: 0, errors: 0 };
    let droppedEvents = 0;
    let serverTime = started;
    let rejected: TceResult<never> | null = null;
    for (const plan of plans) {
      // Off, a new install id or forget since this flush planned: the rest
      // was wiped, belongs to the old id or is about to be deleted.
      if (stale(c, since)) {
        schedulePersist(c);
        return null;
      }
      const sentAt = now(c);
      if (!isEpochMs(sentAt)) return err('unavailable', 'device clock is out of range');
      const req = toRequest(envR.value, plan, newUuid(c), sentAt);
      const out = await postJson(c.net, `${c.baseUrl}/api/batch`, JSON.stringify(req), c.timeoutMs, () => now(c));
      const resp = out.ok ? readBatchResponse(out.json) : null;
      if (resp) {
        settle(c.queue, plan, revs, currentId(c));
        accepted.sessions += resp.accepted.sessions;
        accepted.events += resp.accepted.events;
        accepted.errors += resp.accepted.errors;
        droppedEvents += resp.droppedEvents;
        serverTime = resp.serverTime;
        c.failures = 0;
        c.retryAt = 0;
        c.capWarned = false;
        continue;
      }
      // A 2xx that is not the TCE's answer is retried like a network failure:
      // nothing is removed (see readBatchResponse).
      const failed = out.ok
        ? { error: foreignBody(out.status, 'batch'), retryable: true, retryAfterMs: null, status: out.status }
        : out;
      if (failed.retryable) {
        c.failures++;
        const wait = retryDelay(c.failures, failed.retryAfterMs);
        c.retryAt = now(c) + wait;
        c.log.warn('telemetry: batch not delivered; will retry', {
          code: failed.error.code,
          status: failed.status,
          retryInMs: wait,
          retryAfterMs: failed.retryAfterMs,
        });
        schedulePersist(c);
        return { ok: false, error: failed.error };
      }
      // Final rejection: drop this batch so one bad item cannot block the
      // queue forever.
      settle(c.queue, plan, revs, currentId(c));
      c.failures = 0;
      c.retryAt = 0;
      c.log.error('telemetry: batch rejected; dropped', {
        code: failed.error.code,
        message: failed.error.message,
        field: failed.error.field,
        status: failed.status,
        sessions: plan.sessions.length,
        events: plan.events.length,
        errors: plan.errors.length,
      });
      rejected = { ok: false, error: failed.error };
    }
    schedulePersist(c);
    return rejected ?? ok({ serverTime, accepted, droppedEvents });
  } catch (e) {
    c.log.error('telemetry: flush failed', { error: describe(e) });
    return err('internal', `flush failed: ${describe(e)}`);
  }
}

/** TceClient.flush: starts a flush, or joins the one running; null while forget or an id reset runs. */
export function flush(c: ClientContext): Promise<TceResult<BatchResponse> | null> {
  // Delete my data or a new install id is in progress: nothing goes out.
  if (c.forgetting || c.resetting > 0) return Promise.resolve(null);
  if (!c.inflight) {
    c.inflight = doFlush(c).finally(() => {
      c.inflight = null;
    });
  }
  return c.inflight;
}
