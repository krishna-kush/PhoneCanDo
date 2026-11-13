import assert from 'node:assert/strict';
import { test } from 'node:test';
import { base64urlLength, decodeBase64url, encodeBase64url } from './base64url.ts';

test('round-trips every length and matches Node', () => {
  for (let len = 0; len < 70; len++) {
    const bytes = new Uint8Array(len).map((_, i) => (i * 73 + len) & 0xff);
    const text = encodeBase64url(bytes);
    assert.equal(text, Buffer.from(bytes).toString('base64url'));
    assert.deepEqual(decodeBase64url(text), bytes);
  }
});

test('refuses text no encoder makes', () => {
  assert.equal(decodeBase64url('a'), null); // impossible length
  assert.equal(decodeBase64url('ab+/'), null); // base64, not base64url
  assert.equal(decodeBase64url('ab=='), null); // padding
  assert.equal(decodeBase64url('AB'), null); // non-zero leftover bits
});

test('32 random bytes are 43 chars', () => {
  assert.equal(base64urlLength(32), 43);
});
