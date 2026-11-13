// POST /v1/account/signout: ends this phone's session; the account and the
// other phones' sessions stay.

import { BODY_CAP } from '../limits.ts';
import { ok } from '../result.ts';
import type { Route } from '../route.ts';
import { authenticate } from '../session.ts';

/** POST /v1/account/signout. */
export const signoutRoute: Route = {
  name: 'signout',
  method: 'POST',
  path: '/v1/account/signout',
  bucket: 'public',
  maxBodyBytes: BODY_CAP.none,
  async handle(req, ctx) {
    const caller = await authenticate(req, ctx);
    if (!caller.ok) return caller;
    await ctx.store.deleteSession(caller.value.tokenHash);
    return ok({ ok: true });
  },
};
