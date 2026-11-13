// Sessions: a random bearer token the phone keeps in its Keystore. We keep
// only its SHA-256, so a copy of the database signs nobody in. A session ends
// after SESSION_IDLE_MS without use; its last use is written once a day.

import { encodeBase64url } from './base64url.ts';
import { SECRET_BYTES, SESSION_IDLE_MS, SESSION_TOUCH_MS } from './limits.ts';
import type { AccountsCtx, AccountsRequest } from './route.ts';
import type { CryptoPort } from './ports.ts';
import { err, ok, type Result } from './result.ts';
import type { AccountRow } from './store.ts';
import { isSecretShape } from './wire.ts';

/** A new session token or nonce: base64url of SECRET_BYTES random bytes. */
export function makeSecret(crypto: CryptoPort): string {
  return encodeBase64url(crypto.randomBytes(SECRET_BYTES));
}

/** The token of an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(authorization: string | null): string | null {
  const m = authorization ? /^Bearer ([^\s]+)$/i.exec(authorization.trim()) : null;
  return m && isSecretShape(m[1]!) ? m[1]! : null;
}

/** The signed-in caller. */
export interface Caller {
  account: AccountRow;
  tokenHash: string;
}

/** The caller's session and account, or signed_out. A session unused too long is deleted here. */
export async function authenticate(req: AccountsRequest, ctx: AccountsCtx): Promise<Result<Caller>> {
  const token = bearerToken(req.authorization);
  if (!token) return err('signed_out', 'no session token');
  const tokenHash = await ctx.crypto.sha256Hex(token);
  const found = await ctx.store.findSession(tokenHash);
  if (!found) return err('signed_out', 'unknown session');
  const now = ctx.clock.now();
  if (now - found.session.lastUsed > SESSION_IDLE_MS) {
    await ctx.store.deleteSession(tokenHash);
    return err('signed_out', 'session ended after 180 days without use');
  }
  if (now - found.session.lastUsed >= SESSION_TOUCH_MS) {
    await ctx.store.touchSession(tokenHash, found.account.id, now);
    found.account.lastSeen = now;
  }
  return ok({ account: found.account, tokenHash });
}
