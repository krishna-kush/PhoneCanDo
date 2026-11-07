// apk.mjs over a fake unzip: no APK needed.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { makeApkReader } from './apk.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const LISTING = [
  'AndroidManifest.xml',
  'lib/arm64-v8a/liboc-engine.so',
  'lib/arm64-v8a/libproot.so',
  'assets/default-image/rootfs.tar.xz',
  '',
].join('\n');

function fakeUnzip(entries) {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    if (args[0] === '-Z1') return { status: 0, stdout: Buffer.from(LISTING), stderr: Buffer.from('') };
    const bytes = entries[args[2]];
    return bytes ? { status: 0, stdout: bytes, stderr: Buffer.from('') } : { status: 11, stdout: Buffer.from(''), stderr: Buffer.from('caution: filename not matched') };
  };
  return { run, calls };
}

test('hashes the Linux entries only', () => {
  const lib = Buffer.from('proot');
  const rootfs = Buffer.from('xz');
  const fake = fakeUnzip({ 'lib/arm64-v8a/libproot.so': lib, 'assets/default-image/rootfs.tar.xz': rootfs });
  const found = makeApkReader(fake).linuxEntries('/x/app.apk');
  assert.deepEqual(found, { 'lib/arm64-v8a/libproot.so': sha(lib), 'assets/default-image/rootfs.tar.xz': sha(rootfs) });
  assert.deepEqual(fake.calls.map((args) => args.slice(0, 2)), [['-Z1', '/x/app.apk'], ['-p', '/x/app.apk'], ['-p', '/x/app.apk']]);
});

test('an entry unzip cannot read throws', () => {
  const fake = fakeUnzip({});
  assert.throws(() => makeApkReader(fake).linuxEntries('/x/app.apk'), /filename not matched/);
});
