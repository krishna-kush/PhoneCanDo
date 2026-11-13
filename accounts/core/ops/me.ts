// GET /v1/account: the signed-in account (also how the app checks its
// session still holds).

import { BODY_CAP } from '../limits.ts';
import { ok } from '../result.ts';
import type { Route } from '../route.ts';
import { authenticate } from '../session.ts';
import { accountWire } from '../wire.ts';

/** GET /v1/account. */
export const meRoute: Route = {
  name: 'me',
  method: 'GET',
  path: '/v1/account',
  bucket: 'public',
  maxBodyBytes: BODY_CAP.none,
  async handle(req, ctx) {
    const caller = await authenticate(req, ctx);
    if (!caller.ok) return caller;
    return ok({ account: accountWire(caller.value.account) });
  },
};
