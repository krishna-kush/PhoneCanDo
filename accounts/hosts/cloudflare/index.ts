// The accounts routes in a Cloudflare Worker. The Worker that serves the API
// host (tce/hosts/cloudflare) hands every request to accountsFetch first; a
// path outside /v1/account answers null and the Worker goes on with its own
// routes. The caller's address never comes here: the Worker's limiter is
// passed in as `limit`.

import { createKeyCache } from '../../core/google/keys.ts';
import type { Clock, CryptoPort, KeySource } from '../../core/ports.ts';
import { parseClientIds } from '../../core/config.ts';
import type { RateLimitBucket } from '../../core/route.ts';
import { answer, errorAnswer, findRoute, isAccountsPath, type Answer } from '../../core/router.ts';
import { googleJwks } from '../../runtime/google-jwks.ts';
import { webCrypto } from '../../runtime/webcrypto.ts';
import { createD1Driver } from '../../stores/d1/index.ts';
import { createSqlStore } from '../../stores/sql/store.ts';
import { readJsonBody } from './body.ts';
import type { AccountsEnv } from './env.ts';
import { jsonLogger } from './log.ts';

export type { AccountsEnv } from './env.ts';
export type { RateLimitBucket } from '../../core/route.ts';

/** Asks the Worker's limiter: resolves true when the caller may go on, false when over the limit. */
export type AccountsLimiter = (bucket: RateLimitBucket) => Promise<boolean>;

/** The accounts handler's signature: a Response for /v1/account paths, null for every other path. */
export type AccountsFetch = (request: Request, url: URL, env: AccountsEnv, limit: AccountsLimiter) => Promise<Response | null>;

/** Platform pieces a test may swap; production uses Web Crypto, the system clock and Google's live keys. */
export interface AccountsDeps {
  keys?: KeySource;
  clock?: Clock;
  crypto?: CryptoPort;
}

const systemClock: Clock = { now: () => Date.now() };

// why module scope: Google's keys are cached for this isolate's life, not refetched per request.
let liveKeys: KeySource | null = null;
function sharedKeys(): KeySource {
  liveKeys ??= createKeyCache(googleJwks(), systemClock);
  return liveKeys;
}

/** An AccountsFetch over `deps`. */
export function createAccountsFetch(deps: AccountsDeps = {}): AccountsFetch {
  return async (request, url, env, limit) => {
    if (!isAccountsPath(url.pathname)) return null;
    const requestId = request.headers.get('cf-ray') ?? (deps.crypto ?? webCrypto).uuid();
    const log = jsonLogger({ requestId });

    const route = findRoute(request.method, url.pathname);
    if (!route) return respond(errorAnswer('not_found'));
    // why: the Worker can ship before its accounts database is bound.
    const db = env.ACCOUNTS_DB;
    if (!db) return respond(errorAnswer('not_configured'));

    let allowed = true;
    try {
      allowed = await limit(route.bucket);
    } catch (e) {
      // A broken limiter must not take sign-in down.
      log.warn('limiter failed; allowing', { error: e instanceof Error ? e.message : String(e) });
    }
    if (!allowed) return respond(errorAnswer('rate_limited'));

    let body: unknown;
    if (route.maxBodyBytes > 0) {
      const read = await readJsonBody(request, route.maxBodyBytes);
      if (!read) return respond(errorAnswer('bad_request'));
      body = read.value;
    }

    const ctx = {
      store: createSqlStore(createD1Driver(db)),
      clock: deps.clock ?? systemClock,
      crypto: deps.crypto ?? webCrypto,
      keys: deps.keys ?? sharedKeys(),
      config: { clientIds: parseClientIds(env.GOOGLE_CLIENT_IDS) },
      log,
    };
    const req = { method: request.method, path: url.pathname, authorization: request.headers.get('authorization'), body };
    return respond(await answer(route, req, ctx));
  };
}

/** The accounts routes for the live Worker. */
export const accountsFetch: AccountsFetch = createAccountsFetch();

function respond(a: Answer): Response {
  return new Response(JSON.stringify(a.json), { status: a.status, headers: a.headers });
}
