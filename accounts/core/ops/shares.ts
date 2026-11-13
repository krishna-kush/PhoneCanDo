// PUT /v1/account/shares: the phone's share links joined with the ones the
// account already keeps (from this phone or another), so a new phone shows
// every link once you sign in. Only codes and times: which app a link went
// through stays on the phone that sent it.

import { BODY_CAP, MAX_SHARES } from '../limits.ts';
import { ok } from '../result.ts';
import type { Route } from '../route.ts';
import { authenticate } from '../session.ts';
import { parseSharesBody } from '../wire.ts';

/** PUT /v1/account/shares. */
export const sharesRoute: Route = {
  name: 'shares',
  method: 'PUT',
  path: '/v1/account/shares',
  bucket: 'public',
  maxBodyBytes: BODY_CAP.shares,
  async handle(req, ctx) {
    const caller = await authenticate(req, ctx);
    if (!caller.ok) return caller;
    const links = parseSharesBody(req.body);
    if (!links.ok) return links;
    const kept = await ctx.store.mergeShares(caller.value.account.id, links.value, MAX_SHARES);
    return ok({ links: kept });
  },
};
