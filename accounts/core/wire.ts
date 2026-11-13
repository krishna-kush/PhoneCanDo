// The JSON the API speaks: what it answers about an account, and the checks
// on what the app sends. Parsers check shape and caps, nothing else.

import { base64urlLength } from './base64url.ts';
import { ID_TOKEN_MAX_CHARS, MAX_SHARES, SECRET_BYTES } from './limits.ts';
import { err, ok, type Result } from './result.ts';
import type { AccountRow, ShareLinkRow } from './store.ts';

/** What the API says about an account. */
export interface AccountWire {
  email: string;
  /** First sign-in, ms. */
  createdAt: number;
}

/** A share link's code: 8 chars, no l, o, 0 or 1 (the app makes them). */
export const SHARE_CODE = /^[a-km-np-z2-9]{8}$/;

/** A nonce or session token: base64url of SECRET_BYTES random bytes. */
const SECRET = new RegExp(`^[A-Za-z0-9_-]{${base64urlLength(SECRET_BYTES)}}$`);

/** True for text shaped like a nonce or session token we made. */
export function isSecretShape(text: string): boolean {
  return SECRET.test(text);
}

/** The account as the API answers it. */
export function accountWire(row: AccountRow): AccountWire {
  return { email: row.email, createdAt: row.created };
}

/** POST /v1/account/signin body. */
export interface SigninBody {
  idToken: string;
  nonce: string;
}

/** Checks a sign-in body. */
export function parseSigninBody(body: unknown): Result<SigninBody> {
  if (!isObject(body)) return err('bad_request', 'body must be a JSON object');
  const { idToken, nonce } = body;
  if (typeof idToken !== 'string' || idToken.length === 0 || idToken.length > ID_TOKEN_MAX_CHARS) {
    return err('bad_request', 'idToken must be a string of at most 4096 chars');
  }
  if (typeof nonce !== 'string' || !isSecretShape(nonce)) return err('bad_request', 'nonce is not one we issue');
  return ok({ idToken, nonce });
}

/** Checks a PUT /v1/account/shares body; a code sent twice keeps its earliest time. */
export function parseSharesBody(body: unknown): Result<ShareLinkRow[]> {
  if (!isObject(body) || !Array.isArray(body.links)) return err('bad_request', 'body must be { "links": [...] }');
  if (body.links.length > MAX_SHARES) return err('bad_request', `at most ${MAX_SHARES} links`);
  const byCode = new Map<string, number>();
  for (const [i, link] of body.links.entries()) {
    if (!isObject(link)) return err('bad_request', `links.${i} must be an object`);
    const { code, created } = link;
    if (typeof code !== 'string' || !SHARE_CODE.test(code)) return err('bad_request', `links.${i}.code is not a share code`);
    if (typeof created !== 'number' || !Number.isSafeInteger(created) || created <= 0) {
      return err('bad_request', `links.${i}.created must be a positive integer (ms)`);
    }
    const seen = byCode.get(code);
    if (seen === undefined || created < seen) byCode.set(code, created);
  }
  return ok([...byCode].map(([code, created]) => ({ code, created })));
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
