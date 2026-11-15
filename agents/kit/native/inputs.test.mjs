// inputs.mjs: the digest over build/ and payload.libs.
//   node --test agents/kit/native/inputs.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { inputsDigest, INPUTS_RE } from './inputs.mjs';

const manifest = { payload: { libs: [{ name: 'libdm-engine.so', from: 'demo.bin', role: 'engine' }] } };

function kind(t) {
  const dir = mkdtempSync(join(tmpdir(), 'inputs-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  mkdirSync(join(dir, 'build/patches'), { recursive: true });
  writeFileSync(join(dir, 'build/pins.env'), 'DEMO_VERSION=1\n');
  writeFileSync(join(dir, 'build/build.sh'), 'echo build\n');
  writeFileSync(join(dir, 'build/patches/a.patch'), 'patch\n');
  return dir;
}

test('a sha256 digest, the same for the same files', (t) => {
  const dir = kind(t);
  const digest = inputsDigest(dir, manifest);
  assert.match(digest, INPUTS_RE);
  assert.equal(inputsDigest(dir, manifest), digest);
});

test('pins, patches and the build script change it; files outside build/ do not', (t) => {
  const dir = kind(t);
  const before = inputsDigest(dir, manifest);
  writeFileSync(join(dir, 'README.md'), 'docs\n');
  mkdirSync(join(dir, 'ci'));
  writeFileSync(join(dir, 'ci/check.sh'), 'check\n');
  assert.equal(inputsDigest(dir, manifest), before);
  for (const file of ['build/pins.env', 'build/build.sh', 'build/patches/a.patch']) {
    writeFileSync(join(dir, file), 'changed\n');
    assert.notEqual(inputsDigest(dir, manifest), before, file);
  }
});

test('a new patch, or a renamed one, changes it', (t) => {
  const dir = kind(t);
  const before = inputsDigest(dir, manifest);
  writeFileSync(join(dir, 'build/patches/b.patch'), 'patch\n');
  assert.notEqual(inputsDigest(dir, manifest), before);
  rmSync(join(dir, 'build/patches/b.patch'));
  assert.equal(inputsDigest(dir, manifest), before);
  rmSync(join(dir, 'build/patches/a.patch'));
  writeFileSync(join(dir, 'build/patches/c.patch'), 'patch\n');
  assert.notEqual(inputsDigest(dir, manifest), before);
});

test('payload.libs names and build files count; role and linkage do not', (t) => {
  const dir = kind(t);
  const before = inputsDigest(dir, manifest);
  const lib = manifest.payload.libs[0];
  assert.equal(inputsDigest(dir, { payload: { libs: [{ ...lib, role: 'other', linkage: 'x' }] } }), before);
  assert.notEqual(inputsDigest(dir, { payload: { libs: [{ ...lib, name: 'libdm-other.so' }] } }), before);
  assert.notEqual(inputsDigest(dir, { payload: { libs: [{ ...lib, from: 'other.bin' }] } }), before);
});
