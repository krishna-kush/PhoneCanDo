// The pending queue: session upserts, events and errors not yet accepted by
// the server. Persisted as JSON under STORAGE_KEYS.queue; a corrupted or
// foreign value is reset instead of crashing the app, and an item with an id
// the server would reject is skipped, so it cannot sink a whole batch.

import { UUID } from '../core/identity.ts';
import { isEventName } from '../core/schema/events.ts';
import { err, ok, type TceResult } from '../core/result.ts';
import type { ErrorKind, ErrorWire, EventWire, SessionWire } from '../core/schema/wire.ts';

/** Format version of the persisted queue JSON. */
export const QUEUE_FORMAT = 1;

/**
 * One session the client knows about. `wire` holds every field gathered so
 * far (the server merges, so resending all of it is safe). `dirty` means it
 * changed since the server last accepted it; `rev` counts changes so a flush
 * can tell whether the session changed while its request was in flight.
 */
export interface SessionRecord {
  wire: SessionWire;
  dirty: boolean;
  rev: number;
  /** Next per-session sequence number, shared by events and errors. */
  nextSeq: number;
}

/** In-memory queue. Arrays are oldest first. */
export interface QueueState {
  sessions: SessionRecord[];
  events: EventWire[];
  errors: ErrorWire[];
}

/** A fresh, empty queue. */
export function emptyQueue(): QueueState {
  return { sessions: [], events: [], errors: [] };
}

/** Events + errors + sessions; the unit LIMITS.queueCap counts. */
export function countItems(q: QueueState): number {
  return q.sessions.length + q.events.length + q.errors.length;
}

/** True when nothing needs sending: no events, no errors, no changed session. */
export function isIdle(q: QueueState): boolean {
  return q.events.length === 0 && q.errors.length === 0 && !q.sessions.some((s) => s.dirty);
}

/** Session ids referenced by queued events and errors. */
export function referencedSessions(q: QueueState): Set<string> {
  const ids = new Set<string>();
  for (const e of q.events) ids.add(e.sessionId);
  for (const e of q.errors) if (e.sessionId !== null) ids.add(e.sessionId);
  return ids;
}

/**
 * Removes sessions that need no more sending: clean, not current and not
 * referenced by any queued event or error.
 */
export function pruneSessions(q: QueueState, currentId: string | null): void {
  const refs = referencedSessions(q);
  q.sessions = q.sessions.filter((s) => s.dirty || s.wire.sessionId === currentId || refs.has(s.wire.sessionId));
}

/**
 * Drops items until the queue holds at most `cap`: oldest events first, then
 * oldest errors, then the oldest previous sessions nothing references. The
 * current session is never dropped. Returns how many items were dropped.
 */
export function enforceCap(q: QueueState, cap: number, currentId: string | null): number {
  let over = countItems(q) - cap;
  if (over <= 0) return 0;
  let dropped = 0;
  const events = Math.min(over, q.events.length);
  if (events > 0) {
    q.events.splice(0, events);
    over -= events;
    dropped += events;
  }
  const errors = Math.min(over, q.errors.length);
  if (errors > 0) {
    q.errors.splice(0, errors);
    over -= errors;
    dropped += errors;
  }
  if (over > 0) {
    const refs = referencedSessions(q);
    q.sessions = q.sessions.filter((s) => {
      if (over <= 0 || s.wire.sessionId === currentId || refs.has(s.wire.sessionId)) return true;
      over--;
      dropped++;
      return false;
    });
  }
  return dropped;
}

interface PersistedSession {
  wire: SessionWire;
  dirty: boolean;
  nextSeq: number;
}

interface PersistedQueue {
  v: typeof QUEUE_FORMAT;
  /**
   * The session that was current when this was written. Optional, so a queue
   * written before it existed still reads, and an older build reading this
   * one ignores it.
   */
  current?: string;
  sessions: PersistedSession[];
  events: EventWire[];
  errors: ErrorWire[];
}

/**
 * JSON for storage. `current` is the session the writing process counts as
 * its own, so the next process can tell which stored session ran last.
 */
export function serializeQueue(q: QueueState, current: string | null = null): string {
  const body: PersistedQueue = {
    v: QUEUE_FORMAT,
    sessions: q.sessions.map((s) => ({ wire: s.wire, dirty: s.dirty, nextSeq: s.nextSeq })),
    events: q.events,
    errors: q.errors,
  };
  if (current !== null) body.current = current;
  return JSON.stringify(body);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

const KINDS: readonly ErrorKind[] = ['js', 'native', 'engine'];

function readSession(raw: unknown): PersistedSession | null {
  if (!isObj(raw) || !isObj(raw.wire)) return null;
  // Why drop engineStderrTail: a queue an older build wrote may hold raw
  // engine output, which is never sent automatically (sanitizeSessionFields).
  const { engineStderrTail: _engineOutput, ...w } = raw.wire;
  if (typeof w.sessionId !== 'string' || !UUID.test(w.sessionId) || !isNum(w.startedAt)) return null;
  return {
    wire: w as unknown as SessionWire,
    dirty: raw.dirty === true,
    nextSeq: isNum(raw.nextSeq) && raw.nextSeq >= 1 ? Math.floor(raw.nextSeq) : 1,
  };
}

function readEvent(raw: unknown): EventWire | null {
  if (!isObj(raw)) return null;
  if (typeof raw.sessionId !== 'string' || !UUID.test(raw.sessionId)) return null;
  if (!isNum(raw.seq) || !isNum(raw.ts) || typeof raw.name !== 'string') return null;
  // The vocabulary may have shrunk in an update; the server would drop it anyway.
  if (!isEventName(raw.name)) return null;
  if (raw.props !== undefined && !isObj(raw.props)) return null;
  return raw as unknown as EventWire;
}

function readError(raw: unknown): ErrorWire | null {
  if (!isObj(raw)) return null;
  if (typeof raw.errorId !== 'string' || !UUID.test(raw.errorId)) return null;
  if (raw.sessionId !== null && (typeof raw.sessionId !== 'string' || !UUID.test(raw.sessionId))) return null;
  if (raw.seq !== null && !isNum(raw.seq)) return null;
  if (!isNum(raw.ts) || !KINDS.includes(raw.kind as ErrorKind)) return null;
  if (typeof raw.className !== 'string' || typeof raw.message !== 'string') return null;
  if (!Array.isArray(raw.frames) || raw.frames.some((f) => typeof f !== 'string')) return null;
  if (raw.version !== undefined && typeof raw.version !== 'string') return null;
  // An older build put a line of engine output in an engine error's message.
  if (raw.kind === 'engine') return { ...(raw as unknown as ErrorWire), message: engineMessage(raw.className) };
  return raw as unknown as ErrorWire;
}

/**
 * The only message an automatic engine error carries: its class, `exit <code>`.
 * Raw engine output can hold prompt text, so it never goes in.
 */
export function engineMessage(className: string): string {
  return className;
}

/**
 * What parseQueue recovered, plus how many malformed items it skipped.
 * `current` is the stored current session's id when the queue holds that
 * session, else null.
 */
export interface ParsedQueue {
  queue: QueueState;
  skipped: number;
  current: string | null;
}

/**
 * Reads a persisted queue. Missing value = empty queue. A value that is not
 * JSON or not this format is `bad_request` (the caller resets and logs);
 * malformed single items are skipped and counted. Every session an item
 * references gets a record, so a batch can always carry its session upsert.
 */
export function parseQueue(raw: string | null): TceResult<ParsedQueue> {
  if (raw === null || raw === '') return ok({ queue: emptyQueue(), skipped: 0, current: null });
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return err('bad_request', 'persisted queue is not JSON');
  }
  if (!isObj(data) || data.v !== QUEUE_FORMAT) return err('bad_request', 'persisted queue has an unknown format');
  if (!Array.isArray(data.sessions) || !Array.isArray(data.events) || !Array.isArray(data.errors)) {
    return err('bad_request', 'persisted queue is missing its lists');
  }
  let skipped = 0;
  const queue = emptyQueue();
  const seen = new Set<string>();
  for (const s of data.sessions) {
    const rec = readSession(s);
    if (!rec || seen.has(rec.wire.sessionId)) {
      skipped++;
      continue;
    }
    seen.add(rec.wire.sessionId);
    queue.sessions.push({ wire: rec.wire, dirty: rec.dirty, rev: 0, nextSeq: rec.nextSeq });
  }
  for (const e of data.events) {
    const ev = readEvent(e);
    if (ev) queue.events.push(ev);
    else skipped++;
  }
  const errorIds = new Set<string>();
  for (const e of data.errors) {
    const er = readError(e);
    if (er && !errorIds.has(er.errorId)) {
      errorIds.add(er.errorId);
      queue.errors.push(er);
    } else skipped++;
  }
  // Recreate a minimal record for any referenced session that went missing.
  const firstTs = new Map<string, number>();
  for (const item of [...queue.events, ...queue.errors]) {
    if (item.sessionId === null || seen.has(item.sessionId)) continue;
    const prev = firstTs.get(item.sessionId);
    if (prev === undefined || item.ts < prev) firstTs.set(item.sessionId, item.ts);
  }
  for (const [sessionId, startedAt] of firstTs) {
    queue.sessions.push({ wire: { sessionId, startedAt }, dirty: false, rev: 0, nextSeq: 1 });
  }
  // A pointer to a session the queue does not hold (dropped, malformed) is no pointer.
  const pointer = typeof data.current === 'string' ? data.current.toLowerCase() : null;
  const current = pointer !== null && queue.sessions.some((s) => s.wire.sessionId === pointer) ? pointer : null;
  return ok({ queue, skipped, current });
}
