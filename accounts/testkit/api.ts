// The accounts API in-process, without a host: a request goes through the
// same router the Worker uses, with a test clock, Web Crypto and a test
// Google key.

import type { Logger } from '../core/ports.ts';
import type { AccountsStore } from '../core/store.ts';
import { answer, errorAnswer, findRoute, type Answer } from '../core/router.ts';
import { webCrypto } from '../runtime/webcrypto.ts';
import type { FakeClock } from './clock.ts';
import { googleClaims, TEST_CLIENT_ID, type TestSigner } from './google.ts';

/** What a test call sends. */
export interface CallOptions {
  token?: string;
  body?: unknown;
}

/** A test's handle on the API. */
export interface TestApi {
  call(method: string, path: string, options?: CallOptions): Promise<Answer>;
  /** nonce + signin with a good token for `sub`/`email`; the session token. */
  signIn(claims?: Record<string, unknown>): Promise<string>;
}

/** Logs nowhere. */
export const silentLog: Logger = { info() {}, warn() {}, error() {} };

/** A TestApi over `store`. */
export function createTestApi(store: AccountsStore, clock: FakeClock, signer: TestSigner, clientIds: readonly string[] = [TEST_CLIENT_ID]): TestApi {
  const ctx = { store, clock, crypto: webCrypto, keys: signer.keys, config: { clientIds }, log: silentLog };
  const call: TestApi['call'] = async (method, path, o = {}) => {
    const route = findRoute(method, path);
    if (!route) return errorAnswer('not_found');
    const authorization = o.token === undefined ? null : `Bearer ${o.token}`;
    return answer(route, { method, path, authorization, body: o.body }, ctx);
  };
  return {
    call,
    async signIn(claims = {}) {
      const { nonce } = (await call('POST', '/v1/account/nonce')).json as { nonce: string };
      const idToken = await signer.sign(googleClaims(clock.now(), nonce, claims));
      const res = await call('POST', '/v1/account/signin', { body: { idToken, nonce } });
      if (res.status !== 200) throw new Error(`sign-in failed: ${JSON.stringify(res.json)}`);
      return (res.json as { token: string }).token;
    },
  };
}
