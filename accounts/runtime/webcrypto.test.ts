import assert from 'node:assert/strict';
import { test } from 'node:test';
import { webCrypto } from './webcrypto.ts';

test('sha256Hex matches the known vector', async () => {
  assert.equal(await webCrypto.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('randomBytes and uuid', () => {
  assert.equal(webCrypto.randomBytes(32).length, 32);
  assert.match(webCrypto.uuid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('a key Web Crypto cannot import verifies nothing', async () => {
  const data = new Uint8Array([1, 2, 3]);
  assert.equal(await webCrypto.verifyRs256({ kid: 'x', n: '!!', e: '??' }, data, data), false);
});
