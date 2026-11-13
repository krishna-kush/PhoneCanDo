// A route is the unit of server behaviour: one file in ops/, one line in
// ops/registry.ts. Routes see neither HTTP frameworks nor platform types.

import type { AccountsConfig } from './config.ts';
import type { Clock, CryptoPort, KeySource, Logger } from './ports.ts';
import type { Result } from './result.ts';
import type { AccountsStore } from './store.ts';

/** Everything a route may use; built by the host per request. */
export interface AccountsCtx {
  store: AccountsStore;
  clock: Clock;
  crypto: CryptoPort;
  keys: KeySource;
  config: AccountsConfig;
  log: Logger;
}

/** What a host hands a route. */
export interface AccountsRequest {
  method: string;
  path: string;
  /** The Authorization header, as sent. */
  authorization: string | null;
  /** Parsed JSON body; undefined when there was none (or the route takes none). */
  body: unknown;
}

/** Which of the host's limiters counts a route: `rare` for sign-in and delete, `public` for the rest. */
export type RateLimitBucket = 'rare' | 'public';

/** One route of the accounts API. */
export interface Route {
  readonly name: string;
  readonly method: 'GET' | 'POST' | 'PUT';
  readonly path: string;
  readonly bucket: RateLimitBucket;
  /** Body cap in bytes; 0: the body is not read. */
  readonly maxBodyBytes: number;
  /** The JSON to answer with status 200, or an error. */
  handle(req: AccountsRequest, ctx: AccountsCtx): Promise<Result<unknown>>;
}
