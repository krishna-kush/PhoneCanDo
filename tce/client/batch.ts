// Splits the pending queue into BatchRequests that respect every list cap
// and LIMITS.batchBodyBytes. Sizes are measured as UTF-8 JSON, the same
// thing the host checks before parsing.

import { LIMITS, SCHEMA_VERSION } from '../core/schema/limits.ts';
import type {
  AppWire,
  BatchRequest,
  DeviceWire,
  ErrorWire,
  EventWire,
  IdentityWire,
  SessionWire,
} from '../core/schema/wire.ts';
import { jsonBytes } from './sanitize.ts';

/** The identity part every batch repeats. */
export interface Envelope {
  identity: IdentityWire;
  device: DeviceWire;
  app: AppWire;
}

/** Caps a plan must respect; LIMITS by default, smaller in tests. */
export interface BatchCaps {
  bodyBytes: number;
  sessions: number;
  events: number;
  errors: number;
}

/** The server's caps. */
export const DEFAULT_CAPS: BatchCaps = {
  bodyBytes: LIMITS.batchBodyBytes,
  sessions: LIMITS.sessionsPerBatch,
  events: LIMITS.eventsPerBatch,
  errors: LIMITS.errorsPerBatch,
};

/** The content of one future BatchRequest. Items are the queue's own objects. */
export interface BatchPlan {
  sessions: SessionWire[];
  events: EventWire[];
  errors: ErrorWire[];
}

/** What to send. */
export interface PlanInput {
  /** Every known session by id. */
  sessions: ReadonlyMap<string, SessionWire>;
  /** Sessions that changed since last accepted; sent even with no items. */
  dirty: readonly string[];
  events: readonly EventWire[];
  errors: readonly ErrorWire[];
}

/** Plans plus items that cannot fit in any batch on their own (dropped by the caller). */
export interface PlanResult {
  plans: BatchPlan[];
  oversized: Array<EventWire | ErrorWire>;
}

// Placeholders as long as or longer than the real values, so a plan measured
// with them never grows when the real batchId and sentAt are filled in.
const SIZE_BATCH_ID = 'x'.repeat(36);
const SIZE_SENT_AT = Number.MAX_SAFE_INTEGER;

/** Wraps a plan into the request that goes on the wire. */
export function toRequest(env: Envelope, plan: BatchPlan, batchId: string, sentAt: number): BatchRequest {
  return {
    schema: SCHEMA_VERSION,
    batchId,
    sentAt,
    identity: env.identity,
    device: env.device,
    app: env.app,
    sessions: plan.sessions,
    events: plan.events,
    errors: plan.errors,
  };
}

interface Building {
  plan: BatchPlan;
  ids: Set<string>;
  bytes: number;
}

/**
 * Greedy split: errors first (they matter most), then events, oldest first;
 * each plan carries the session upsert of every session its items reference;
 * changed sessions with no items ride along where they fit. Each array
 * element is costed at its JSON size plus one comma, so a plan's real size
 * is never above the estimate.
 */
export function planBatches(env: Envelope, input: PlanInput, caps: BatchCaps = DEFAULT_CAPS): PlanResult {
  const base = jsonBytes(toRequest(env, { sessions: [], events: [], errors: [] }, SIZE_BATCH_ID, SIZE_SENT_AT));
  const plans: BatchPlan[] = [];
  const oversized: Array<EventWire | ErrorWire> = [];
  const sessionCost = new Map<string, number>();
  const costOf = (id: string): number => {
    let c = sessionCost.get(id);
    if (c === undefined) {
      const wire = input.sessions.get(id);
      c = wire ? jsonBytes(wire) + 1 : 0;
      sessionCost.set(id, c);
    }
    return c;
  };
  const fresh = (): Building => ({ plan: { sessions: [], events: [], errors: [] }, ids: new Set(), bytes: base });
  let cur = fresh();
  const isEmpty = (b: Building) => b.plan.sessions.length + b.plan.events.length + b.plan.errors.length === 0;
  const close = () => {
    if (!isEmpty(cur)) plans.push(cur.plan);
    cur = fresh();
  };

  const fits = (b: Building, item: EventWire | ErrorWire, kind: 'event' | 'error', itemBytes: number): boolean => {
    const sid = item.sessionId;
    const addSession = sid !== null && input.sessions.has(sid) && !b.ids.has(sid);
    if (kind === 'event' && b.plan.events.length >= caps.events) return false;
    if (kind === 'error' && b.plan.errors.length >= caps.errors) return false;
    if (addSession && b.plan.sessions.length >= caps.sessions) return false;
    return b.bytes + itemBytes + (addSession ? costOf(sid) : 0) <= caps.bodyBytes;
  };

  const add = (b: Building, item: EventWire | ErrorWire, kind: 'event' | 'error', itemBytes: number) => {
    const sid = item.sessionId;
    if (sid !== null && input.sessions.has(sid) && !b.ids.has(sid)) {
      b.ids.add(sid);
      b.plan.sessions.push(input.sessions.get(sid)!);
      b.bytes += costOf(sid);
    }
    if (kind === 'event') b.plan.events.push(item as EventWire);
    else b.plan.errors.push(item as ErrorWire);
    b.bytes += itemBytes;
  };

  const place = (item: EventWire | ErrorWire, kind: 'event' | 'error') => {
    const itemBytes = jsonBytes(item) + 1;
    if (fits(cur, item, kind, itemBytes)) {
      add(cur, item, kind, itemBytes);
      return;
    }
    if (!isEmpty(cur)) {
      close();
      if (fits(cur, item, kind, itemBytes)) {
        add(cur, item, kind, itemBytes);
        return;
      }
    }
    oversized.push(item);
  };

  for (const e of input.errors) place(e, 'error');
  for (const e of input.events) place(e, 'event');

  // Changed sessions nothing referenced yet.
  const planned = new Set<string>();
  for (const p of plans) for (const s of p.sessions) planned.add(s.sessionId);
  for (const id of cur.ids) planned.add(id);
  for (const id of input.dirty) {
    if (planned.has(id) || !input.sessions.has(id)) continue;
    const cost = costOf(id);
    if (cur.plan.sessions.length >= caps.sessions || cur.bytes + cost > caps.bodyBytes) close();
    // A single session always fits: its fields are capped far below the body cap.
    cur.ids.add(id);
    cur.plan.sessions.push(input.sessions.get(id)!);
    cur.bytes += cost;
    planned.add(id);
  }
  close();
  return { plans, oversized };
}
