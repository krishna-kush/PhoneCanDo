// Readers for the TCE's 2xx answers to batch, report and forget, and the
// error for a 2xx that is not one. Pure: they only check the shape of
// already-parsed JSON.

import type { TceError } from '../core/result.ts';
import type { BatchResponse, ForgetResponse, ReportResponse } from '../core/schema/wire.ts';

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Why a 2xx body must parse as the op's response before anything is
// dropped: a captive portal, a proxy or a CDN page can answer 200 with its
// own body, and the TCE always answers its ops with JSON of the documented
// shape. Anything else means the data did not reach it.

/** The BatchResponse in a 2xx body, or null when the body is not one. */
export function readBatchResponse(json: unknown): BatchResponse | null {
  if (!isRecord(json) || !isRecord(json.accepted)) return null;
  const { serverTime, droppedEvents } = json;
  const { sessions, events, errors } = json.accepted;
  if (!isNum(serverTime) || !isNum(droppedEvents) || !isNum(sessions) || !isNum(events) || !isNum(errors)) return null;
  return { serverTime, accepted: { sessions, events, errors }, droppedEvents };
}

/** The ReportResponse in a 2xx body, or null when the body is not one. */
export function readReportResponse(json: unknown): ReportResponse | null {
  if (!isRecord(json) || typeof json.reportId !== 'string' || !isNum(json.serverTime)) return null;
  return { reportId: json.reportId, serverTime: json.serverTime };
}

/** The ForgetResponse in a 2xx body (non-numeric counts left out), or null when the body is not one. */
export function readForgetResponse(json: unknown): ForgetResponse | null {
  if (!isRecord(json) || !isRecord(json.deleted)) return null;
  const deleted: Record<string, number> = {};
  for (const [k, v] of Object.entries(json.deleted)) if (isNum(v)) deleted[k] = v;
  return { deleted };
}

/** The error for a 2xx whose body is not the op's response. */
export function foreignBody(status: number, op: string): TceError {
  return { code: 'unavailable', message: `HTTP ${status}, but the body is not a ${op} response` };
}
