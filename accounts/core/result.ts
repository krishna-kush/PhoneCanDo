// Typed results. Expected failures (bad input, a bad Google token, no session,
// sign-in not set up) are values, never throws. A store or upstream that
// fails throws; the router turns that into `internal` and logs it.

/** Every error the API answers, as `{ "error": code }`. */
export type ErrorCode =
  | 'bad_request' // shape or value invalid, or a body over its cap
  | 'bad_token' // the Google ID token or its nonce did not check out
  | 'signed_out' // no session, an unknown one, or one unused for too long
  | 'rate_limited' // the host's limiter refused the caller
  | 'not_configured' // no Google client IDs set: sign-in is off on this server
  | 'not_found' // a method or path under /v1/account that is not a route
  | 'internal'; // a bug or a store that failed; logged with the request id

export interface AccountsError {
  readonly code: ErrorCode;
  readonly message: string;
}

export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: AccountsError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(code: ErrorCode, message: string): Result<never> {
  return { ok: false, error: { code, message } };
}

/** HTTP status for each code; ops never pick statuses for errors. */
export const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  bad_request: 400,
  bad_token: 401,
  signed_out: 401,
  rate_limited: 429,
  not_configured: 503,
  not_found: 404,
  internal: 500,
};
