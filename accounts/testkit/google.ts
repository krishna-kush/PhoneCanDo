// A stand-in for Google: an RSA key pair that signs ID tokens the way Google
// does (RS256 compact JWS), and a KeySource that lists its public half.

import { encodeBase64url } from '../core/base64url.ts';
import type { KeySource, RsaPublicJwk } from '../core/ports.ts';

/** The web client ID tests sign tokens for. */
export const TEST_CLIENT_ID = 'test-web-client.apps.googleusercontent.com';

const ALG = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

/** Signs ID tokens with one test key. */
export interface TestSigner {
  jwk: RsaPublicJwk;
  /** A KeySource that knows only this signer's key. */
  keys: KeySource;
  /** A compact JWS of `payload` with header { alg: RS256, kid } (plus `header` overrides). */
  sign(payload: Record<string, unknown>, header?: Record<string, unknown>): Promise<string>;
}

/** A new signer with a fresh 2048-bit key named `kid`. */
export async function createTestSigner(kid = 'test-key-1'): Promise<TestSigner> {
  const pair = (await crypto.subtle.generateKey(
    { ...ALG, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const pub = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const jwk: RsaPublicJwk = { kid, n: pub.n!, e: pub.e! };
  const text = (v: unknown): string => encodeBase64url(new TextEncoder().encode(JSON.stringify(v)));
  return {
    jwk,
    keys: { key: async (k) => (k === kid ? jwk : null) },
    async sign(payload, header = {}) {
      const signed = `${text({ alg: 'RS256', kid, typ: 'JWT', ...header })}.${text(payload)}`;
      const sig = await crypto.subtle.sign(ALG, pair.privateKey, new TextEncoder().encode(signed));
      return `${signed}.${encodeBase64url(new Uint8Array(sig))}`;
    },
  };
}

/** Claims of a good Google ID token at `nowMs` for `nonce`, with `overrides`. */
export function googleClaims(nowMs: number, nonce: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const nowS = Math.floor(nowMs / 1000);
  return {
    iss: 'https://accounts.google.com',
    azp: 'test-android-client.apps.googleusercontent.com',
    aud: TEST_CLIENT_ID,
    sub: '109876543210987654321',
    email: 'friend@example.com',
    email_verified: true,
    name: 'A Friend',
    iat: nowS,
    exp: nowS + 3600,
    nonce,
    ...overrides,
  };
}
