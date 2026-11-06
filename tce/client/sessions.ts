// Sessions: opening, closing and rotating the current one, merging fields
// into a session record, and the public session calls (start, update, end,
// and the previous process's session for the adapter). A record's nextSeq
// numbers the events and errors filed under it (record.ts).

import type { SessionWire } from '../core/schema/wire.ts';
import { newUuid, now, type ClientContext } from './context.ts';
import { capQueue } from './local-data.ts';
import { describe } from './log.ts';
import { schedulePersist } from './persistence.ts';
import type { SessionRecord } from './queue.ts';
import { isEpochMs, mergeCounters, sanitizeApp, sanitizeSessionFields, type SessionFields } from './sanitize.ts';

// The build a new session runs, so a session flushed by a later (updated)
// process is still credited to the build that ran it. Left out when the
// platform cannot say.
function appStamp(c: ClientContext): Pick<SessionWire, 'version' | 'versionCode' | 'channel'> {
  try {
    const app = sanitizeApp(c.env.app());
    return { version: app.version, versionCode: app.versionCode, channel: app.channel };
  } catch (e) {
    c.log.warn('telemetry: app facts unavailable for the session', { error: describe(e) });
    return {};
  }
}

function openSession(c: ClientContext): SessionRecord {
  if (c.current) closeCurrent(c);
  const rec: SessionRecord = {
    wire: { sessionId: newUuid(c), startedAt: now(c), ...appStamp(c) },
    dirty: true,
    rev: 1,
    nextSeq: 1,
  };
  c.current = rec;
  c.lastOpenedId = rec.wire.sessionId;
  if (c.enabled) {
    c.queue.sessions.push(rec);
    capQueue(c);
    schedulePersist(c);
  }
  return rec;
}

function closeCurrent(c: ClientContext): void {
  const rec = c.current;
  c.current = null;
  if (!rec) return;
  const endedAt = now(c);
  rec.wire = isEpochMs(endedAt) ? { ...rec.wire, endedAt } : { ...rec.wire };
  rec.dirty = true;
  rec.rev++;
}

/**
 * A fresh current session that is not linked to the old one (after an id
 * reset, forget or turning back on). The old record is simply abandoned.
 */
export function rotateSession(c: ClientContext): void {
  if (!c.current) return;
  c.current = null;
  openSession(c);
}

/** The current session, opened on the spot when there is none. */
export function ensureSession(c: ClientContext): SessionRecord {
  return c.current ?? openSession(c);
}

/** The queued record of a session, if the queue holds it. */
export function findRecord(c: ClientContext, sessionId: string): SessionRecord | undefined {
  return c.queue.sessions.find((s) => s.wire.sessionId === sessionId);
}

// Merges sanitized fields into a session record and marks it for sending.
// A counters update replaces each named counter (the server keeps the
// newest value). endedAt marks the app leaving the foreground, when Android
// may freeze or kill it: the queue is written now, not after the debounce.
function mergeInto(c: ClientContext, rec: SessionRecord, fields: SessionFields): void {
  const clean = sanitizeSessionFields(fields ?? {});
  const next = { ...rec.wire, ...clean };
  if (fields && fields.counters !== undefined) {
    const counters = mergeCounters(rec.wire.counters, fields.counters);
    if (counters) next.counters = counters;
  }
  rec.wire = next;
  rec.dirty = true;
  rec.rev++;
  schedulePersist(c, clean.endedAt !== undefined);
}

/**
 * Makes sure a record exists for a session an error names, so its batch
 * carries a session upsert. An error can name a session other than the
 * current one.
 */
export function ensureRecord(c: ClientContext, sessionId: string, ts: number): void {
  if (findRecord(c, sessionId)) return;
  c.queue.sessions.push({ wire: { sessionId, startedAt: ts }, dirty: false, rev: 0, nextSeq: 1 });
}

/** TceClient.startSession: closes the current session and opens a new one. */
export function startSession(c: ClientContext): string {
  return openSession(c).wire.sessionId;
}

/** TceClient.updateSession: merges fields into the current session (opened if needed). */
export function updateSession(c: ClientContext, fields: SessionFields): void {
  try {
    // Off means off: nothing from the off period is kept for later.
    if (!c.enabled) return;
    mergeInto(c, ensureSession(c), fields);
  } catch (e) {
    c.log.error('telemetry: updateSession failed', { error: describe(e) });
  }
}

/** TceClient.endSession: closes the current session and writes the queue at once. */
export function endSession(c: ClientContext): void {
  if (!c.current) return;
  closeCurrent(c);
  // The process may be about to end.
  if (c.enabled) schedulePersist(c, true);
}

/** AdapterClient.previousSession: a copy of the stored queue's current session while the queue holds it. */
export function previousSession(c: ClientContext): SessionWire | null {
  if (!c.enabled || c.previousId === null) return null;
  const rec = findRecord(c, c.previousId);
  return rec ? { ...rec.wire, ...(rec.wire.counters ? { counters: { ...rec.wire.counters } } : {}) } : null;
}

/** AdapterClient.updatePreviousSession: merges fields into previousSession(); false when there is none. */
export function updatePreviousSession(c: ClientContext, fields: SessionFields): boolean {
  try {
    if (!c.enabled || c.previousId === null) return false;
    const rec = findRecord(c, c.previousId);
    if (!rec) return false;
    mergeInto(c, rec, fields);
    return true;
  } catch (e) {
    c.log.error('telemetry: updatePreviousSession failed', { error: describe(e) });
    return false;
  }
}
