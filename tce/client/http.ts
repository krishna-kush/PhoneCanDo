// One JSON POST through the NetPort, classified into success, retryable
// failure or final failure. Never throws.

import { isRetryable, type ErrorCode, type TceError } from '../core/result.ts';
import type { NetPort } from './types.ts';

/**
 * Result of a POST. `fromBody` says the error came from the server's own
 * ErrorBody. `retryAfterMs` is the wait the server asked for (Retry-After),
 * or null when it named none.
 */
export type PostOutcome =
  | { ok: true; status: number; json: unknown }
  | {
      ok: false;
      status: number | null;
      error: TceError;
      retryable: boolean;
      fromBody: boolean;
      retryAfterMs: number | null;
    };

const CODES: readonly ErrorCode[] = [
  'bad_request',
  'too_large',
  'unsupported',
  'not_found',
  'forbidden',
  'unavailable',
  'internal',
];

/**
 * ErrorCode for a failed response that carried no ErrorBody. Such a response
 * did not come from the TCE (a proxy, a challenge page, a redirect during a
 * domain move), so it reads as `unavailable`; only a 5xx that is not a
 * gateway or overload status reads as `internal`.
 */
export function codeForStatus(status: number): ErrorCode {
  if (status >= 500 && status !== 502 && status !== 503 && status !== 504) return 'internal';
  return 'unavailable';
}

/**
 * Why a 405 is retried even with the server's ErrorBody: the SDK only ever
 * POSTs to routes that take POST, so a 405 means the request arrived as
 * something else. A 301/302 on the way (a domain move, an http->https hop)
 * makes the platform follow it as a GET, and the router refuses the GET with
 * its own ErrorBody (`bad_request`). The op never saw the data, so dropping
 * it would lose data over a transport fault that a later attempt survives.
 */
const METHOD_NOT_ALLOWED = 405;

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function readErrorBody(json: unknown): TceError | null {
  if (typeof json !== 'object' || json === null) return null;
  const e = (json as { error?: unknown }).error;
  if (typeof e !== 'object' || e === null) return null;
  const { code, message, field } = e as { code?: unknown; message?: unknown; field?: unknown };
  if (typeof code !== 'string' || !CODES.includes(code as ErrorCode)) return null;
  const msg = typeof message === 'string' ? message : code;
  return typeof field === 'string' ? { code: code as ErrorCode, message: msg, field } : { code: code as ErrorCode, message: msg };
}

function describe(e: unknown): string {
  if (e instanceof Error) return e.message || e.name;
  return String(e);
}

/**
 * Milliseconds to wait from a Retry-After value: delta-seconds or an
 * HTTP-date (RFC 9110 §10.2.3). Null when absent, malformed or in the past.
 */
export function parseRetryAfter(value: unknown, nowMs: number): number | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) {
    const ms = Number(v) * 1000;
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  }
  const at = Date.parse(v);
  if (!Number.isFinite(at)) return null;
  const ms = at - nowMs;
  return ms > 0 ? ms : null;
}

/**
 * POSTs `body` to `url`. Network failures, timeouts, 5xx, 405, 408 and 429
 * are retryable, and so is any other non-2xx without the server's ErrorBody:
 * a 4xx is final only when the TCE itself answered it with a final code (a
 * proxy or captive-portal page must not make the client drop data). A 405
 * reads as `unavailable` even with an ErrorBody (see METHOD_NOT_ALLOWED).
 * `now` reads the clock for an HTTP-date Retry-After.
 */
export async function postJson(
  net: NetPort,
  url: string,
  body: string,
  timeoutMs: number,
  now: () => number = () => 0,
): Promise<PostOutcome> {
  let res: Awaited<ReturnType<NetPort['post']>>;
  try {
    res = await net.post(url, body, timeoutMs);
  } catch (e) {
    return {
      ok: false,
      status: null,
      error: { code: 'unavailable', message: `network: ${describe(e)}` },
      retryable: true,
      fromBody: false,
      retryAfterMs: null,
    };
  }
  const status = typeof res?.status === 'number' ? res.status : 0;
  const json = parseJson(typeof res?.text === 'string' ? res.text : '');
  if (status >= 200 && status < 300) return { ok: true, status, json };
  if (status === METHOD_NOT_ALLOWED) {
    const said = readErrorBody(json)?.message;
    return {
      ok: false,
      status,
      error: { code: 'unavailable', message: said ? `HTTP 405: ${said}` : 'HTTP 405' },
      retryable: true,
      // The error is not the body's: its code would read as a final verdict.
      fromBody: false,
      retryAfterMs: parseRetryAfter(res?.retryAfter, now()),
    };
  }
  const fromBody = readErrorBody(json);
  const error: TceError = fromBody ?? { code: codeForStatus(status), message: `HTTP ${status}` };
  const clientError = status >= 400 && status < 500 && status !== 408 && status !== 429;
  const retryable = clientError ? fromBody === null || isRetryable(fromBody.code) : true;
  const retryAfterMs = retryable ? parseRetryAfter(res?.retryAfter, now()) : null;
  return { ok: false, status, error, retryable, fromBody: fromBody !== null, retryAfterMs };
}
