// A report's content: which recent events go in, and how the body shrinks
// under LIMITS.reportBodyBytes. Pure; report.ts sends it.

import { LIMITS } from '../core/schema/limits.ts';
import type { EventWire, ReportRequest } from '../core/schema/wire.ts';
import { isEpochMs, tail, utf8Length } from './sanitize.ts';

/**
 * A report over its body cap keeps at least this many recent events before
 * it trims the log tail (the engine's crash output matters more than the
 * oldest events), then trims the rest.
 */
export const REPORT_EVENTS_FLOOR = 20;

/** Recent events plus anything still queued, oldest first, deduplicated, at most LIMITS.reportEvents. */
export function reportEvents(recent: readonly EventWire[], queued: readonly EventWire[]): EventWire[] {
  const byKey = new Map<string, EventWire>();
  for (const e of [...recent, ...queued]) if (isEpochMs(e.ts)) byKey.set(`${e.sessionId}#${e.seq}`, e);
  return [...byKey.values()]
    .sort((a, b) => a.ts - b.ts || a.seq - b.seq)
    .slice(-LIMITS.reportEvents);
}

/**
 * The report's JSON body, shrunk under LIMITS.reportBodyBytes (trimming
 * `req` in place): oldest events down to REPORT_EVENTS_FLOOR first, then the
 * head of the log tail, then the remaining events.
 */
export function fitReport(req: ReportRequest): string {
  let body = JSON.stringify(req);
  const over = () => utf8Length(body) - LIMITS.reportBodyBytes;
  while (over() > 0 && req.events.length > REPORT_EVENTS_FLOOR) {
    const cut = Math.max(1, Math.min(req.events.length - REPORT_EVENTS_FLOOR, Math.ceil(req.events.length / 4)));
    req.events = req.events.slice(cut);
    body = JSON.stringify(req);
  }
  while (over() > 0 && req.logTail) {
    const keep = req.logTail.length - over();
    if (keep > 0) req.logTail = tail(req.logTail, keep);
    else delete req.logTail;
    body = JSON.stringify(req);
  }
  while (over() > 0 && req.events.length > 0) {
    req.events = req.events.slice(Math.max(1, Math.ceil(req.events.length / 4)));
    body = JSON.stringify(req);
  }
  return body;
}
