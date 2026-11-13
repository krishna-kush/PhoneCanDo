// POST /v1/account/nonce: a one-use nonce for the next sign-in. The app puts
// it into Credential Manager's request, Google signs it into the ID token, and
// signin uses it up, so a token caught on its way can't sign in twice.

import { BODY_CAP, NONCE_TTL_MS } from '../limits.ts';
import { err, ok } from '../result.ts';
import type { Route } from '../route.ts';
import { makeSecret } from '../session.ts';

/** POST /v1/account/nonce. */
export const nonceRoute: Route = {
  name: 'nonce',
  method: 'POST',
  path: '/v1/account/nonce',
  bucket: 'public',
  maxBodyBytes: BODY_CAP.none,
  async handle(_req, ctx) {
    // why here too: the app learns sign-in is off before it opens Google's sheet.
    if (ctx.config.clientIds.length === 0) return err('not_configured', 'sign-in is not set up on this server');
    const nonce = makeSecret(ctx.crypto);
    const now = ctx.clock.now();
    await ctx.store.putNonce(nonce, now + NONCE_TTL_MS, now);
    return ok({ nonce });
  },
};
