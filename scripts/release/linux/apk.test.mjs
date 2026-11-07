// A built APK's Linux entries against what the preflight checked.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedLinuxEntries, isLinuxEntry, linuxEntryProblems } from './apk.mjs';

const proot = { version: '5.1.107.102', libs: { 'libproot.so': 'a'.repeat(64), 'libproot-loader.so': 'b'.repeat(64) } };
const image = { version: '20261107-e541287e', sha256: 'c'.repeat(64), release: 'linux-image-20261107-e541287e', info: 'e'.repeat(64) };
const EVERYTHING = {
  'lib/arm64-v8a/libproot.so': 'a'.repeat(64),
  'lib/arm64-v8a/libproot-loader.so': 'b'.repeat(64),
  'assets/default-image/rootfs.tar.xz': 'c'.repeat(64),
  'assets/default-image/image.json': 'e'.repeat(64),
};

test('Linux entries: the proot libs of any ABI and the image dir only', () => {
  assert.ok(isLinuxEntry('lib/arm64-v8a/libproot.so'));
  assert.ok(isLinuxEntry('lib/x86_64/libproot-loader.so'));
  assert.ok(isLinuxEntry('assets/default-image/extra.txt'));
  assert.ok(!isLinuxEntry('lib/arm64-v8a/liboc-engine.so'));
  assert.ok(!isLinuxEntry('assets/xterm/terminal.bundle.html'));
});

test('everything staged: four entries expected', () => {
  assert.deepEqual(expectedLinuxEntries({ proot, image }), EVERYTHING);
  assert.deepEqual(expectedLinuxEntries({ proot: null, image: null }), {});
});

test('an APK carrying exactly the staged files: no problems', () => {
  assert.deepEqual(linuxEntryProblems(EVERYTHING, { ...EVERYTHING }), []);
  assert.deepEqual(linuxEntryProblems({}, {}), []);
});

test('missing, different or unexpected entries are each a problem', () => {
  const found = { ...EVERYTHING, 'lib/arm64-v8a/libproot.so': 'f'.repeat(64), 'assets/default-image/stray': 'd'.repeat(64) };
  delete found['assets/default-image/image.json'];
  assert.deepEqual(linuxEntryProblems(EVERYTHING, found), [
    `lib/arm64-v8a/libproot.so has sha256 ${'f'.repeat(64)}, the staged file ${'a'.repeat(64)}`,
    'assets/default-image/image.json is missing',
    'assets/default-image/stray is in the APK but not in what the preflight checked',
  ]);
});

test('--without-linux: an APK that still carries proot is refused', () => {
  const problems = linuxEntryProblems({}, { 'lib/arm64-v8a/libproot.so': 'a'.repeat(64) });
  assert.equal(problems.length, 1);
});
