// track() and error(): app calls turned into queued wire items. Both take
// the next number from their session's shared sequence, drop bad input
// instead of throwing, and record nothing while telemetry is off.

import { UUID } from '../core/identity.ts';
import { isEventName } from '../core/schema/events.ts';
import type { ErrorKind, ErrorWire, EventWire, PropValue } from '../core/schema/wire.ts';
import { isNum, newUuid, now, type ClientContext } from './context.ts';
import { capQueue, remember } from './local-data.ts';
import { describe } from './log.ts';
import { schedulePersist } from './persistence.ts';
import { engineMessage } from './queue.ts';
import { sanitizeErrorText, sanitizeFrames, sanitizeProps, shortText } from './sanitize.ts';
import { ensureRecord, ensureSession } from './sessions.ts';
import type { ErrorInput } from './types.ts';

const KINDS: readonly ErrorKind[] = ['js', 'native', 'engine'];

/** TceClient.track: queues a known event under the current session (opened if needed). */
export function track(c: ClientContext, name: string, props?: Record<string, PropValue>): void {
  try {
    if (!c.enabled) return;
    if (typeof name !== 'string' || !isEventName(name)) {
      c.log.warn('telemetry: unknown event name dropped', { name: shortText(String(name), '') });
      return;
    }
    const rec = ensureSession(c);
    const ev: EventWire = { sessionId: rec.wire.sessionId, seq: rec.nextSeq++, ts: now(c), name };
    const clean = sanitizeProps(props);
    if (clean) ev.props = clean;
    c.queue.events.push(ev);
    remember(c, ev);
    capQueue(c);
    schedulePersist(c);
  } catch (e) {
    c.log.error('telemetry: track failed', { error: describe(e) });
  }
}

/** TceClient.error: queues an error (idempotent by errorId) and writes the queue at once. */
export function error(c: ClientContext, input: ErrorInput): void {
  try {
    if (!c.enabled || !input) return;
    const ts = isNum(input.ts) ? Math.round(input.ts) : now(c);
    let sessionId: string | null;
    let seq: number | null = null;
    if (input.sessionId === undefined) {
      const rec = ensureSession(c);
      if (ts < rec.wire.startedAt) {
        // Timed before this session began (e.g. an engine exit noticed
        // late): it belongs to no session, not to this one.
        sessionId = null;
      } else {
        sessionId = rec.wire.sessionId;
        seq = rec.nextSeq++;
      }
    } else if (input.sessionId === null) {
      sessionId = null;
    } else {
      const given = String(input.sessionId).toLowerCase();
      // A session id the server would reject is dropped, not the error.
      sessionId = UUID.test(given) ? given : null;
      if (sessionId !== null) {
        if (c.current && c.current.wire.sessionId === sessionId) seq = c.current.nextSeq++;
        else ensureRecord(c, sessionId, ts);
      }
    }
    const given = typeof input.errorId === 'string' ? input.errorId.toLowerCase() : '';
    const errorId = UUID.test(given) ? given : newUuid(c);
    // Resends of the same error (native crashes) stay idempotent.
    if (c.queue.errors.some((e) => e.errorId === errorId)) return;
    const text = sanitizeErrorText(input.className, input.message);
    const kind = KINDS.includes(input.kind) ? input.kind : 'js';
    const wire: ErrorWire = {
      errorId,
      sessionId,
      seq,
      ts,
      kind,
      className: text.className,
      message: kind === 'engine' ? engineMessage(text.className) : text.message,
      frames: sanitizeFrames(input.frames),
    };
    if (typeof input.version === 'string' && input.version.trim()) wire.version = shortText(input.version);
    c.queue.errors.push(wire);
    capQueue(c);
    schedulePersist(c, true);
  } catch (e) {
    c.log.error('telemetry: error() failed', { error: describe(e) });
  }
}
