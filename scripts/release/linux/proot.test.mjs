// The proot gate on staged-lib descriptions (no files, no build).
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { okProot, PROOT_VERSION } from './fixtures.mjs';
import { parsePins, parseSums, prootGate, prootVerdict } from './proot.mjs';

const none = () => ({ ...okProot(), libs: { 'libproot.so': null, 'libproot-loader.so': null }, sums: null, marked: false });

test('parsePins: KEY=value lines, comments and blanks skipped', () => {
  assert.deepEqual(parsePins('# c\nPROOT_VERSION=5.1.107.102\n\nTALLOC_VERSION=2.5.0\n  # x=y\n'), {
    PROOT_VERSION: '5.1.107.102',
    TALLOC_VERSION: '2.5.0',
  });
});

test('parseSums: sha256sum lines, null on anything else or a repeated name', () => {
  const a = 'a'.repeat(64);
  assert.deepEqual([...parseSums(`${a}  libproot.so\n${a} *x.so\n`)], [['libproot.so', a], ['x.so', a]]);
  assert.equal(parseSums('nonsense\n'), null);
  assert.equal(parseSums(`${a}  x.so\n${a}  x.so\n`), null);
});

test('staged and verified: ok, and what ships is recorded', () => {
  const verdict = prootVerdict(okProot());
  assert.equal(verdict.ok, true);
  assert.match(verdict.summary, /^proot 5\.1\.107\.102 staged, matches its SHA256SUMS/);
  assert.deepEqual(verdict.staged, {
    version: PROOT_VERSION,
    libs: { 'libproot.so': 'a'.repeat(64), 'libproot-loader.so': 'b'.repeat(64) },
  });
});

test('not staged: refused, and the summary names --without-linux', () => {
  const verdict = prootVerdict(none());
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^not staged: full and lite must ship Linux .*--without-linux/);
  assert.equal(verdict.staged, null);
});

test('not staged with --without-linux: ok, nothing ships', () => {
  const verdict = prootVerdict(none(), { withoutLinux: true });
  assert.equal(verdict.ok, true);
  assert.match(verdict.summary, /--without-linux: full and lite ship no proot/);
  assert.equal(verdict.staged, null);
});

test('staged with --without-linux: still checked', () => {
  const staged = okProot();
  staged.libs['libproot.so'].sha256 = 'f'.repeat(64);
  assert.equal(prootVerdict(staged, { withoutLinux: true }).ok, false);
  assert.equal(prootVerdict(okProot(), { withoutLinux: true }).ok, true);
});

test('a lib whose sha256 differs from SHA256SUMS: refused', () => {
  const staged = okProot();
  staged.libs['libproot-loader.so'].sha256 = 'f'.repeat(64);
  const verdict = prootVerdict(staged);
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^libproot-loader\.so is not the verified build: sha256 ffffffffffff, SHA256SUMS says bbbbbbbbbbbb/);
});

test('one lib missing or empty: refused', () => {
  const staged = okProot();
  staged.libs['libproot-loader.so'] = { size: 0, sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' };
  const verdict = prootVerdict(staged);
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^libproot-loader\.so is missing or empty/);
});

test('no SHA256SUMS next to the libs, or one listing other files: refused', () => {
  assert.match(prootVerdict({ ...okProot(), sums: null }).summary, /^no SHA256SUMS next to the staged libs/);
  const one = `${'a'.repeat(64)}  libproot.so\n`;
  assert.match(prootVerdict({ ...okProot(), sums: one }).summary, /must list exactly libproot\.so and libproot-loader\.so/);
});

test('libproot.so built from another PROOT_VERSION: refused as stale', () => {
  const verdict = prootVerdict({ ...okProot(), marked: false });
  assert.equal(verdict.ok, false);
  assert.match(verdict.summary, /^libproot\.so is not proot 5\.1\.107\.102 \(lre\/proot\/pins\.env\): a stale build/);
});

test('every problem is listed: the first in the summary, the rest in detail', () => {
  const staged = { ...okProot(), sums: null, marked: false };
  const verdict = prootVerdict(staged);
  assert.equal(verdict.detail.length, 1);
});

test('gate: never overridable, and leaves what ships in state', () => {
  const state = {};
  const gate = prootGate({ linux: { proot: () => okProot() }, withoutLinux: false }, state);
  assert.deepEqual([gate.id, gate.ok, gate.overridable], ['proot', true, false]);
  assert.equal(state.proot.version, PROOT_VERSION);
  const refused = prootGate({ linux: { proot: none } }, state);
  assert.deepEqual([refused.ok, refused.overridable, state.proot], [false, false, null]);
});
