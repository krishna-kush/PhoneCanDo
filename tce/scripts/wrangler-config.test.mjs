// Tests scripts/wrangler-config.mjs against the real Worker config.
//   node --test tce/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { d1DatabaseOf, parseJsonc, readWranglerConfig } from './wrangler-config.mjs';

test('parseJsonc strips comments outside strings and trailing commas', () => {
  const text = '{\n  // line\n  "a": "x // not a comment", /* block */\n  "b": [1, 2,],\n}';
  assert.deepEqual(parseJsonc(text), { a: 'x // not a comment', b: [1, 2] });
});

test('the real wrangler.jsonc names the Worker and its D1 database', () => {
  const config = readWranglerConfig();
  assert.equal(typeof config.name, 'string');
  assert.ok(config.name.length > 0);
  assert.match(d1DatabaseOf(config).database_id, /^[0-9a-f-]{36}$/);
});

test('d1DatabaseOf refuses a missing entry or id', () => {
  assert.throws(() => d1DatabaseOf({}), /no d1_databases entry/);
  assert.throws(() => d1DatabaseOf({ d1_databases: [{ binding: 'DB', database_name: 'x' }] }), /"x" has no database_id/);
});
