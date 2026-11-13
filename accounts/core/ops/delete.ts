// POST /v1/account/delete: Delete account. The account, every phone's
// session and the share list go at once; nothing of it is kept. Usage stats
// are never linked to an account, so they are untouched (Settings → Privacy →
// Delete my data removes those).

import { BODY_CAP } from '../limits.ts';
import { ok } from '../result.ts';
import type { Route } from '../route.ts';
import { authenticate } from '../session.ts';

/** POST /v1/account/delete. */
export const deleteRoute: Route = {
  name: 'delete',
  method: 'POST',
  path: '/v1/account/delete',
  bucket: 'rare',
  maxBodyBytes: BODY_CAP.none,
  async handle(req, ctx) {
    const caller = await authenticate(req, ctx);
    if (!caller.ok) return caller;
    await ctx.store.deleteAccount(caller.value.account.id);
    return ok({ deleted: true });
  },
};
