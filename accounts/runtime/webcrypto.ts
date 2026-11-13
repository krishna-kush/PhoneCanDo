// core's CryptoPort over Web Crypto (crypto.getRandomValues, randomUUID,
// subtle.digest and subtle.verify), which Workers and Node 22 both have.

import type { CryptoPort, RsaPublicJwk } from '../core/ports.ts';

const RS256 = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

/** CryptoPort backed by the global Web Crypto. */
export const webCrypto: CryptoPort = {
  randomBytes(length) {
    return crypto.getRandomValues(new Uint8Array(length));
  },

  uuid() {
    return crypto.randomUUID();
  },

  async sha256Hex(input) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)));
    let hex = '';
    for (const byte of digest) hex += byte.toString(16).padStart(2, '0');
    return hex;
  },

  async verifyRs256(key: RsaPublicJwk, data, signature) {
    const jwk = { kty: 'RSA', n: key.n, e: key.e, alg: 'RS256', ext: true };
    try {
      const k = await crypto.subtle.importKey('jwk', jwk, RS256, false, ['verify']);
      return await crypto.subtle.verify(RS256, k, signature, data);
    } catch {
      // A key Web Crypto refuses to import checks nothing.
      return false;
    }
  },
};
