import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { encodeBase64url } from '../base64url.ts';
import { webCrypto } from '../../runtime/webcrypto.ts';
import { createTestSigner, googleClaims, TEST_CLIENT_ID, type TestSigner } from '../../testkit/google.ts';
import { verifyGoogleIdToken } from './verify.ts';

const NOW = Date.UTC(2026, 10, 12, 12, 0, 0);
const NONCE = 'N'.repeat(43);

let signer: TestSigner;
let other: TestSigner;
before(async () => {
  signer = await createTestSigner('k1');
  other = await createTestSigner('k1'); // same kid, another key: a forged token
});

const check = (token: string, now = NOW, clientIds: readonly string[] = [TEST_CLIENT_ID]) =>
  verifyGoogleIdToken(token, { clientIds, nonce: NONCE, keys: signer.keys, crypto: webCrypto, now });

const reason = async (token: string, now = NOW): Promise<string> => {
  const r = await check(token, now);
  assert.equal(r.ok, false);
  if (r.ok) return '';
  assert.equal(r.error.code, 'bad_token');
  return r.error.message;
};

test('a good token gives its account number and email', async () => {
  const r = await check(await signer.sign(googleClaims(NOW, NONCE)));
  assert.deepEqual(r, { ok: true, value: { sub: '109876543210987654321', email: 'friend@example.com' } });
});

test('email_verified as the string "true" passes too', async () => {
  assert.equal((await check(await signer.sign(googleClaims(NOW, NONCE, { email_verified: 'true' })))).ok, true);
});

test('both Google issuers pass', async () => {
  assert.equal((await check(await signer.sign(googleClaims(NOW, NONCE, { iss: 'accounts.google.com' })))).ok, true);
});

test('a token signed by another key is refused', async () => {
  assert.match(await reason(await other.sign(googleClaims(NOW, NONCE))), /signature/);
});

test('a changed payload breaks the signature', async () => {
  const token = await signer.sign(googleClaims(NOW, NONCE));
  const [h, , s] = token.split('.');
  const forged = encodeBase64url(new TextEncoder().encode(JSON.stringify(googleClaims(NOW, NONCE, { sub: 'someone-else' }))));
  assert.match(await reason(`${h}.${forged}.${s}`), /signature/);
});

test('an unknown key id is refused', async () => {
  assert.match(await reason(await signer.sign(googleClaims(NOW, NONCE), { kid: 'k2' })), /key/);
});

test('alg none and other algorithms are refused', async () => {
  assert.match(await reason(await signer.sign(googleClaims(NOW, NONCE), { alg: 'none' })), /RS256/);
  assert.match(await reason(await signer.sign(googleClaims(NOW, NONCE), { alg: 'HS256' })), /RS256/);
});

test('every claim is checked', async () => {
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ iss: 'https://evil.example' }, /Google/],
    [{ aud: 'someone-elses-client' }, /client/],
    [{ aud: [TEST_CLIENT_ID] }, /client/],
    [{ exp: Math.floor(NOW / 1000) - 61 }, /expired/],
    [{ iat: Math.floor(NOW / 1000) + 120 }, /future/],
    [{ sub: '' }, /account number/],
    [{ sub: undefined }, /account number/],
    [{ email: 'not-an-email' }, /email/],
    [{ email_verified: false }, /verified/],
    [{ email_verified: undefined }, /verified/],
    [{ nonce: 'M'.repeat(43) }, /nonce/],
    [{ nonce: undefined }, /nonce/],
  ];
  for (const [over, why] of cases) {
    assert.match(await reason(await signer.sign(googleClaims(NOW, NONCE, over))), why, JSON.stringify(over));
  }
});

test('the clock skew allows a minute either way', async () => {
  const token = await signer.sign(googleClaims(NOW, NONCE, { exp: Math.floor(NOW / 1000) - 30, iat: Math.floor(NOW / 1000) + 30 }));
  assert.equal((await check(token)).ok, true);
});

test('junk is refused, not thrown', async () => {
  for (const junk of ['', 'a.b', 'a.b.c', '...', 'eyJ.eyJ.sig', `${'x'.repeat(10)}.${'y'.repeat(10)}.`]) {
    assert.equal((await check(junk)).ok, false, junk);
  }
});

test('no client IDs: nothing passes', async () => {
  assert.equal((await check(await signer.sign(googleClaims(NOW, NONCE)), NOW, [])).ok, false);
});
