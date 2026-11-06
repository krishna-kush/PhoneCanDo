// POST /api/report: a user-initiated bundle (recent events, a note, a redacted
// engine-log tail and the device snapshot) stored as one reports row.
// Idempotent on reportId: a resend answers the same 200.
// Two storage bounds, because the endpoint is public: at most
// LIMITS.reportsPerDay reports per UTC day across all devices (past it the op
// answers `unavailable` and the client retries tomorrow), and at most
// LIMITS.reportRowBytes per stored row (oldest events are dropped to fit).
// The report also upserts the phone's devices row, built exactly as batch
// builds it, in the same atomic store write: a phone that only ever sent a
// report is then pinned to its verifier, so Delete my data finds (and deletes)
// that report. The store refuses (`forbidden`, 403, nothing written) a report
// whose device is pinned to another verifier, so a known deviceId is not
// enough to file reports as it.

import { deviceRowOf, readIdentity, UUID, type Identity } from '../identity.ts';
import type { HttpOp, HttpResponse, RequestCtx } from '../op.ts';
import { err, ok, type TceResult } from '../result.ts';
import { isEventName } from '../schema/events.ts';
import { LIMITS } from '../schema/limits.ts';
import type { ReportRow } from '../schema/rows.ts';
import type { AppWire, DeviceWire, EventWire, ReportResponse } from '../schema/wire.ts';
import { utcDayStart } from '../time.ts';
import { Reader, utf8Length } from '../validate.ts';
import {
  readApp,
  readDevice,
  readEach,
  readEnvelope,
  readEvent,
  readOptionalTail,
  readOptionalText,
  sanitizePropsObject,
  type ParsedEvent,
} from '../wire-read.ts';

/** A validated, redacted report. */
export interface ReportInput {
  reportId: string;
  identity: Identity;
  device: DeviceWire;
  app: AppWire;
  sessionId: string | null;
  note: string | null;
  events: ParsedEvent[];
  logTail: string | null;
}

/** Validate a ReportRequest body; note and log tail are redacted and truncated. */
export function parseReport(body: unknown): TceResult<ReportInput> {
  const r = new Reader();
  const o = readEnvelope(r, body);
  return r.done({
    reportId: r.match(o.reportId, 'reportId', UUID, 'a lowercase UUID'),
    identity: readIdentity(r, o.identity, 'identity'),
    device: readDevice(r, o.device, 'device'),
    app: readApp(r, o.app, 'app'),
    sessionId: r.optionalMatch(o.sessionId, 'sessionId', UUID, 'a lowercase UUID'),
    note: readOptionalText(r, o.note, 'note', LIMITS.reportNote),
    events: readEach(r, o.events, 'events', LIMITS.reportEvents, readEvent),
    logTail: readOptionalTail(r, o.logTail, 'logTail', LIMITS.logTail),
  });
}

/** Report events as stored: vocabulary names only, props bounded like batch events. */
export function reportEvents(events: readonly ParsedEvent[]): EventWire[] {
  const out: EventWire[] = [];
  for (const e of events) {
    if (!isEventName(e.name)) continue;
    const props = sanitizePropsObject(e.props);
    const wire: EventWire = { sessionId: e.sessionId, seq: e.seq, ts: e.ts, name: e.name };
    out.push(props ? { ...wire, props } : wire);
  }
  return out;
}

/**
 * Stored size of a report row: UTF-8 bytes of every text column plus the
 * decimal text of every number. The JSON columns are measured as the server
 * re-serialized them, so a number sent as `1e20` counts as its 21 digits.
 */
export function reportRowBytes(row: ReportRow): number {
  let n = 0;
  for (const v of Object.values(row) as (string | number | null)[]) {
    if (typeof v === 'string') n += utf8Length(v);
    else if (typeof v === 'number') n += String(v).length;
  }
  return n;
}

/**
 * The row with as many of the newest events as fit LIMITS.reportRowBytes
 * (events are oldest first, so they are dropped from the front), and how many
 * were dropped. Null when the row does not fit even without events; the body
 * cap makes that unreachable for a parsed request (note and log tail are
 * bounded far below the row cap), so it is a guard, not a code path clients see.
 */
export function fitReportRow(
  base: Omit<ReportRow, 'events'>,
  events: readonly EventWire[],
): { row: ReportRow; dropped: number } | null {
  const fixed = reportRowBytes({ ...base, events: '' });
  const sizes = events.map((e) => utf8Length(JSON.stringify(e)));
  let total = sizes.reduce((a, b) => a + b, 0);
  let start = 0;
  // JSON.stringify(array) is '[' + items joined by ',' + ']'.
  const eventsBytes = (): number => 2 + total + Math.max(0, events.length - start - 1);
  while (start < events.length && fixed + eventsBytes() > LIMITS.reportRowBytes) {
    total -= sizes[start]!;
    start++;
  }
  if (fixed + eventsBytes() > LIMITS.reportRowBytes) return null;
  return { row: { ...base, events: JSON.stringify(events.slice(start)) }, dropped: start };
}

/** POST /api/report. */
export const reportOp: HttpOp<ReportInput> = {
  kind: 'http',
  name: 'report',
  method: 'POST',
  path: '/api/report',
  maxBodyBytes: LIMITS.reportBodyBytes,

  parse(req) {
    return parseReport(req.body);
  },

  async run(input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    const received = ctx.clock.now();
    const today = await ctx.store.countReportsSince(utcDayStart(received));
    if (!today.ok) return today;
    if (today.value >= LIMITS.reportsPerDay) {
      return err('unavailable', 'the daily report limit is reached; retry tomorrow');
    }
    const fitted = fitReportRow(
      {
        report_id: input.reportId,
        install_id: input.identity.installId,
        device_id: input.identity.deviceId,
        session_id: input.sessionId,
        version: input.app.version,
        channel: input.app.channel,
        note: input.note,
        log_tail: input.logTail,
        device: JSON.stringify(input.device),
        received,
      },
      reportEvents(input.events),
    );
    if (!fitted) return err('too_large', `the report is over ${LIMITS.reportRowBytes} bytes even without events`);
    if (fitted.dropped > 0) ctx.log.info('report: oldest events dropped to fit the row cap', { dropped: fitted.dropped });
    const device = deviceRowOf(input.identity, input.device, ctx.edge, received);
    const stored = await ctx.store.insertReport(fitted.row, device);
    if (!stored.ok) return stored;
    const json: ReportResponse = { reportId: input.reportId, serverTime: received };
    return ok({ status: 200, json });
  },
};
