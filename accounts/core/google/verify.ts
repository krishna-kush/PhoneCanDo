// Checks a Google ID token the app got from Credential Manager, the way
// Google's docs ask a server to: RS256 under one of Google's published keys,
// issued by Google, for our client, not expired, with a verified email, and
// carrying the nonce we handed out for this sign-in. Any failure is
// bad_token; only an unreadable key set throws (the router answers internal).

import { CLOCK_SKEW_S } from '../limits.ts';
import type { CryptoPort, KeySource } from '../ports.ts';
import { err, ok, type Result } from '../result.ts';
import { splitJwt } from './jwt.ts';

/** What we keep from a good token. */
export interface GoogleIdentity {
  /** Google's account number. */
  sub: string;
  email: string;
}

/** Issuers Google uses for ID tokens. */
const ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/** Caps on what we store from a token. */
const SUB_MAX = 255;
const EMAIL_MAX = 320;

/** Everything verifyGoogleIdToken needs besides the token. */
export interface VerifyOptions {
  clientIds: readonly string[];
  /** The nonce the app says it signed in with; the token must carry the same. */
  nonce: string;
  keys: KeySource;
  crypto: CryptoPort;
  /** ms. */
  now: number;
}

/** The identity in a good Google ID token, or bad_token. */
export async function verifyGoogleIdToken(token: string, o: VerifyOptions): Promise<Result<GoogleIdentity>> {
  const jwt = splitJwt(token);
  if (!jwt) return bad('not a JWT');
  const { header, payload } = jwt;
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return bad('not an RS256 token with a key id');

  const key = await o.keys.key(header.kid);
  if (!key) return bad('signed with a key Google does not list');
  if (!(await o.crypto.verifyRs256(key, jwt.signedBytes, jwt.signature))) return bad('signature does not match');

  const nowS = o.now / 1000;
  const { iss, aud, exp, iat, sub, email, email_verified: verified, nonce } = payload;
  if (typeof iss !== 'string' || !ISSUERS.has(iss)) return bad('not issued by Google');
  if (typeof aud !== 'string' || !o.clientIds.includes(aud)) return bad('issued for another client');
  if (typeof exp !== 'number' || exp + CLOCK_SKEW_S < nowS) return bad('expired');
  if (typeof iat !== 'number' || iat - CLOCK_SKEW_S > nowS) return bad('issued in the future');
  if (typeof sub !== 'string' || sub.length === 0 || sub.length > SUB_MAX) return bad('no account number');
  if (typeof email !== 'string' || !email.includes('@') || email.length > EMAIL_MAX) return bad('no email');
  // Google sends a boolean; older tokens carried the string.
  if (verified !== true && verified !== 'true') return bad('email not verified');
  if (nonce !== o.nonce) return bad('nonce does not match');
  return ok({ sub, email });
}

function bad(message: string): Result<never> {
  return err('bad_token', message);
}
