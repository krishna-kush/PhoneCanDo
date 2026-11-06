// report(): a user-initiated report with recent events, a note and a
// redacted log tail. Works only while enabled; each report on the wire is
// tracked so forget() can wait for it.

import { err, ok, type TceResult } from '../core/result.ts';
import { SCHEMA_VERSION } from '../core/schema/limits.ts';
import type { ReportRequest, ReportResponse } from '../core/schema/wire.ts';
import { currentId, newUuid, now, type ClientContext } from './context.ts';
import { postJson } from './http.ts';
import { envelope } from './identity.ts';
import { init } from './init.ts';
import { describe } from './log.ts';
import { fitReport, reportEvents } from './report-body.ts';
import { foreignBody, readReportResponse } from './responses.ts';
import { sanitizeLogTail, sanitizeNote } from './sanitize.ts';

async function doReport(c: ClientContext, input: { note?: string; logTail?: string }): Promise<TceResult<ReportResponse>> {
  try {
    await init(c);
    if (!c.enabled) return err('forbidden', 'usage stats are off');
    if (c.forgetting) return err('forbidden', 'usage data is being deleted');
    const envR = await envelope(c);
    if (!envR.ok) return envR;
    const req: ReportRequest = {
      schema: SCHEMA_VERSION,
      reportId: newUuid(c),
      identity: envR.value.identity,
      device: envR.value.device,
      app: envR.value.app,
      sessionId: currentId(c),
      events: reportEvents(c.recent, c.queue.events),
    };
    const note = sanitizeNote(input?.note);
    if (note) req.note = note;
    const logTail = sanitizeLogTail(input?.logTail);
    if (logTail) req.logTail = logTail;
    // Forget may have started while the identity was read.
    if (!c.enabled || c.forgetting) return err('forbidden', 'usage stats are off');
    const out = await postJson(c.net, `${c.baseUrl}/v1/report`, fitReport(req), c.timeoutMs, () => now(c));
    if (!out.ok) {
      c.log.warn('telemetry: report not delivered', { code: out.error.code, status: out.status });
      return { ok: false, error: out.error };
    }
    const resp = readReportResponse(out.json);
    if (!resp) {
      // Not the TCE's answer: the report did not arrive; the user can send it again.
      c.log.warn('telemetry: report not delivered', { code: 'unavailable', status: out.status });
      return { ok: false, error: foreignBody(out.status, 'report') };
    }
    return ok(resp);
  } catch (e) {
    c.log.error('telemetry: report failed', { error: describe(e) });
    return err('internal', `report failed: ${describe(e)}`);
  }
}

/** TceClient.report: sends a report and tracks it until it settles, so forget() can wait for it. */
export function report(c: ClientContext, input: { note?: string; logTail?: string }): Promise<TceResult<ReportResponse>> {
  const p = doReport(c, input);
  c.reports.add(p);
  void p.finally(() => c.reports.delete(p));
  return p;
}
