// lock.mjs: a version names one set of build sources.
//   node --test agents/kit/native/lock.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { lockProblems, readLock, writeLock } from './lock.mjs';

function kind(t, version = '1.0.0-demo.1') {
  const dir = mkdtempSync(join(tmpdir(), 'lock-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'build'));
  writeFileSync(join(dir, 'build/pins.env'), 'DEMO_VERSION=1\n');
  return { id: 'demo', dir, manifest: { version, payload: { libs: [{ name: 'libdm-engine.so', from: 'demo.bin' }] } } };
}

test('no lock: a problem until one is written; then none', (t) => {
  const k = kind(t);
  assert.match(lockProblems(k)[0], /no valid payload\.lock: run \.\/manage agent demo lock/);
  writeLock(k);
  assert.equal(readLock(k.dir).version, '1.0.0-demo.1');
  assert.deepEqual(lockProblems(k), []);
});

test('sources changed under the same version: a problem, and lock refuses', (t) => {
  const k = kind(t);
  writeLock(k);
  writeFileSync(join(k.dir, 'build/pins.env'), 'DEMO_VERSION=2\n');
  assert.match(lockProblems(k)[0], /build sources changed but the version is still 1\.0\.0-demo\.1/);
  assert.throws(() => writeLock(k), /bump the version/);
});

test('sources changed with a new version: lock records it', (t) => {
  const k = kind(t);
  writeLock(k);
  writeFileSync(join(k.dir, 'build/pins.env'), 'DEMO_VERSION=2\n');
  k.manifest.version = '1.0.0-demo.2';
  assert.match(lockProblems(k)[0], /records 1\.0\.0-demo\.1, agent\.json says 1\.0\.0-demo\.2/);
  writeLock(k);
  assert.deepEqual(lockProblems(k), []);
});

test('a malformed lock reads as none', (t) => {
  const k = kind(t);
  writeFileSync(join(k.dir, 'payload.lock'), '# only a comment\nnot a lock line\n');
  assert.equal(readLock(k.dir), null);
});
