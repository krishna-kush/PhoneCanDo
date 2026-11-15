// state.mjs: current, outdated or missing, from a staged payload's stamp.
//   node --test agents/kit/native/state.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stagedState } from './state.mjs';

const TREE = 'a'.repeat(64);
const SHA_E = 'e'.repeat(64);
const SHA_U = 'f'.repeat(64);
const libs = [
  { name: 'libdm-engine.so', file: { size: 10, sha256: SHA_E } },
  { name: 'libdm-ui.so', file: { size: 2, sha256: SHA_U } },
];
const sums = `${SHA_E}  libdm-engine.so\n${SHA_U}  libdm-ui.so\n`;
const good = { libs, sums, inputs: TREE, source: 'github run 7 abc1234' };

test('libs equal to SHA256SUMS and INPUTS equal to the tree: current', () => {
  assert.deepEqual(stagedState(good, TREE), { state: 'current', why: [], source: 'github run 7 abc1234' });
});

test('nothing staged: missing', () => {
  const none = { libs: libs.map((l) => ({ ...l, file: null })), sums: null, inputs: null, source: null };
  assert.equal(stagedState(none, TREE).state, 'missing');
});

test('staged before stamps (the old payloads): outdated, saying why', () => {
  const result = stagedState({ libs, sums: null, inputs: null, source: null }, TREE);
  assert.equal(result.state, 'outdated');
  assert.deepEqual(result.why, ['no SHA256SUMS: staged before payloads were stamped', 'no INPUTS: built from unknown sources']);
});

test('built from other sources: outdated', () => {
  const result = stagedState({ ...good, inputs: 'b'.repeat(64) }, TREE);
  assert.equal(result.state, 'outdated');
  assert.match(result.why[0], /built from other sources/);
});

test('a lib changed after staging, or one missing: outdated', () => {
  const changed = stagedState({ ...good, libs: [{ ...libs[0], file: { size: 10, sha256: 'c'.repeat(64) } }, libs[1]] }, TREE);
  assert.match(changed.why[0], /libdm-engine\.so changed since it was staged/);
  const missing = stagedState({ ...good, libs: [libs[0], { ...libs[1], file: null }] }, TREE);
  assert.deepEqual(missing.why, ['libdm-ui.so is missing or empty']);
});

test('a malformed stamp is outdated, never current', () => {
  assert.equal(stagedState({ ...good, sums: 'not sums' }, TREE).state, 'outdated');
  assert.equal(stagedState({ ...good, inputs: 'short' }, TREE).state, 'outdated');
});
