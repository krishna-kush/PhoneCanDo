import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bearerToken } from './session.ts';

test('bearerToken takes only our token shape', () => {
  const t = 'A'.repeat(43);
  assert.equal(bearerToken(`Bearer ${t}`), t);
  assert.equal(bearerToken(`bearer ${t}`), t);
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken(t), null);
  assert.equal(bearerToken('Bearer short'), null);
  assert.equal(bearerToken(`Basic ${t}`), null);
  assert.equal(bearerToken(`Bearer ${t} extra`), null);
});
