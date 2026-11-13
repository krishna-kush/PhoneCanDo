// POST /v1/account/signin: trade a Google ID token (and the nonce it carries)
// for our own session token. The account is keyed on Google's account
// number; its email is refreshed on every sign-in.

import { verifyGoogleIdToken } from '../google/verify.ts';
import { BODY_CAP, SESSION_IDLE_MS } from '../limits.ts';
import { err, ok } from '../result.ts';
import type { Route } from '../route.ts';
import { makeSecret } from '../session.ts';
import { accountWire, parseSigninBody } from '../wire.ts';

/** POST /v1/account/signin. */
export const signinRoute: Route = {
  name: 'signin',
  method: 'POST',
  path: '/v1/account/signin',
  bucket: 'rare',
  maxBodyBytes: BODY_CAP.signin,
  async handle(req, ctx) {
    if (ctx.config.clientIds.length === 0) return err('not_configured', 'sign-in is not set up on this server');
    const body = parseSigninBody(req.body);
    if (!body.ok) return body;
    const now = ctx.clock.now();
    const identity = await verifyGoogleIdToken(body.value.idToken, {
      clientIds: ctx.config.clientIds,
      nonce: body.value.nonce,
      keys: ctx.keys,
      crypto: ctx.crypto,
      now,
    });
    if (!identity.ok) return identity;
    // After the token checks out, so a bad token cannot burn someone else's nonce.
    if (!(await ctx.store.takeNonce(body.value.nonce, now))) return err('bad_token', 'nonce unknown, used or expired');

    const account = await ctx.store.upsertAccount({
      id: ctx.crypto.uuid(),
      googleSub: identity.value.sub,
      email: identity.value.email,
      now,
    });
    await ctx.store.pruneSessions(now - SESSION_IDLE_MS);
    const token = makeSecret(ctx.crypto);
    await ctx.store.createSession({ tokenHash: await ctx.crypto.sha256Hex(token), accountId: account.id, created: now, lastUsed: now });
    return ok({ token, account: accountWire(account) });
  },
};
