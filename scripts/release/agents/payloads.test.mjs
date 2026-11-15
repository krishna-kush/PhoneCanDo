// agents/payloads.mjs: every shipped native payload current, or the release stops.
//   node --test scripts/release/agents/payloads.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { okPayload } from './fixtures.mjs';
import { payloadsVerdict } from './payloads.mjs';

test('current payloads go, naming version and source', () => {
  const verdict = payloadsVerdict([okPayload()]);
  assert.equal(verdict.ok, true);
  assert.equal(verdict.summary, 'opencode 2.0.26-android-phonecando.1 (github run 7 abc1234)');
  assert.deepEqual(verdict.staged, [{ id: 'opencode', version: '2.0.26-android-phonecando.1', inputs: 'a'.repeat(64), source: 'github run 7 abc1234' }]);
});

test('built from other sources: refused, pointing at ./manage agent status', () => {
  const stale = okPayload();
  stale.inputs = 'b'.repeat(64);
  const verdict = payloadsVerdict([stale]);
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^opencode is outdated: built from other sources/);
  assert.match(verdict.summary, /\.\/manage agent status/);
  assert.equal(verdict.staged, null);
});

test('nothing staged: refused as missing', () => {
  const none = okPayload();
  none.stamp = { libs: none.stamp.libs.map((l) => ({ ...l, file: null })), sums: null, inputs: null, source: null };
  assert.match(payloadsVerdict([none]).summary, /^opencode is missing/);
});

test('no native kind at all: nothing to check', () => {
  assert.deepEqual(payloadsVerdict([]), { ok: true, summary: 'no native agent kind ships', detail: [], staged: [] });
});
