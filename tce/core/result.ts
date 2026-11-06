// Typed results. Expected failures (bad input, size caps, a store that is down)
// are values, never throws; hosts map an ErrorCode to an HTTP status. A throw
// out of an op is a bug and becomes `internal` at the host boundary.

export type ErrorCode =
  | 'bad_request' // shape or value invalid
  | 'too_large' // body, list or field over its cap
  | 'unsupported' // schema version the server does not speak
  | 'not_found' // unknown route, channel or resource
  | 'forbidden' // e.g. a cross-origin beacon, ids that do not match
  | 'unavailable' // store or upstream down; the client may retry
  | 'internal'; // a bug; logged with the request id

export interface TceError {
  readonly code: ErrorCode;
  readonly message: string;
  /** Dotted path of the offending field, e.g. `events.3.name`. */
  readonly field?: string;
}

export type TceResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TceError };

export function ok<T>(value: T): TceResult<T> {
  return { ok: true, value };
}

export function err(code: ErrorCode, message: string, field?: string): TceResult<never> {
  return { ok: false, error: field === undefined ? { code, message } : { code, message, field } };
}

/** HTTP status for each code. Hosts use this; ops never pick statuses for errors. */
export const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  bad_request: 400,
  too_large: 413,
  unsupported: 400,
  not_found: 404,
  forbidden: 403,
  unavailable: 503,
  internal: 500,
};

/** Codes a client should retry later (with backoff). Everything else is final. */
export function isRetryable(code: ErrorCode): boolean {
  return code === 'unavailable' || code === 'internal';
}
