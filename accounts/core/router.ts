// Matching a request to a route and turning its result into an answer. Hosts
// do the I/O around it: the limiter, reading the body under the route's cap,
// writing the response.

import { routes } from './ops/registry.ts';
import { err, HTTP_STATUS, type ErrorCode, type Result } from './result.ts';
import type { AccountsCtx, AccountsRequest, Route } from './route.ts';

/** The path every accounts route lives under. */
export const ACCOUNTS_PATH = '/v1/account';

/** Seconds a rate-limited caller is told to wait (Retry-After). */
export const RETRY_AFTER_S = 60;

/** True for a path the accounts API answers (anything else is not ours). */
export function isAccountsPath(path: string): boolean {
  return path === ACCOUNTS_PATH || path.startsWith(`${ACCOUNTS_PATH}/`);
}

/** The route for `method` + `path`, or null. */
export function findRoute(method: string, path: string): Route | null {
  return routes.find((r) => r.method === method && r.path === path) ?? null;
}

/** What a host writes back. */
export interface Answer {
  status: number;
  json: unknown;
  headers: Record<string, string>;
}

/** The answer for an error code. */
export function errorAnswer(code: ErrorCode): Answer {
  const headers: Record<string, string> = { ...BASE_HEADERS };
  if (code === 'rate_limited') headers['retry-after'] = String(RETRY_AFTER_S);
  return { status: HTTP_STATUS[code], json: { error: code }, headers };
}

/** Runs `route`; a throw (a store or Google's keys failing) becomes internal and is logged. */
export async function answer(route: Route, req: AccountsRequest, ctx: AccountsCtx): Promise<Answer> {
  let result: Result<unknown>;
  try {
    result = await route.handle(req, ctx);
  } catch (e) {
    ctx.log.error('route threw', { route: route.name, ...errorFields(e) });
    result = err('internal', 'internal error');
  }
  if (!result.ok) {
    // The message names the check that failed; never a token, nonce or email.
    if (result.error.code !== 'internal') ctx.log.info('refused', { route: route.name, code: result.error.code, why: result.error.message });
    return errorAnswer(result.error.code);
  }
  return { status: 200, json: result.value, headers: { ...BASE_HEADERS } };
}

/** Every answer is JSON and never cached. */
const BASE_HEADERS: Readonly<Record<string, string>> = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
};

function errorFields(e: unknown): Record<string, unknown> {
  return e instanceof Error ? { error: e.name, message: e.message } : { error: String(e) };
}
