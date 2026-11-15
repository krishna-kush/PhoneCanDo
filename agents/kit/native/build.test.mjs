// build.mjs: sources, build.sh, out/INPUTS, and a build of the same sources found again.
//   node --test agents/kit/native/build.test.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { buildKind, builtFrom, defaultWork } from './build.mjs';
import { inputsDigest } from './inputs.mjs';

const manifest = { id: 'demo', payload: { libs: [{ name: 'libdm-engine.so', from: 'demo.bin' }] } };
const quiet = () => {};

// A kind whose build.sh writes demo.bin and counts its runs in <work>/runs.
function fakeKind(t, { sources = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'build-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'kind');
  mkdirSync(join(dir, 'build'), { recursive: true });
  writeFileSync(join(dir, 'build/pins.env'), 'DEMO_VERSION=1\n');
  writeFileSync(join(dir, 'build/build.sh'), 'mkdir -p "$1/out" && echo bin > "$1/out/demo.bin" && echo x >> "$1/runs"\n');
  if (sources) {
    mkdirSync(join(dir, 'ci'));
    writeFileSync(join(dir, 'ci/sources.sh'), 'echo s >> "$1/sources"\n');
  }
  return { root, kind: { id: 'demo', dir, manifest } };
}

const runs = (work, file = 'runs') => readFileSync(join(work, file), 'utf8').trim().split('\n').length;

test('builds, writes out/INPUTS, and finds that build again instead of redoing it', (t) => {
  const { root, kind } = fakeKind(t);
  const work = join(root, 'work');
  const first = buildKind({ kind, work, log: quiet });
  assert.equal(first.reused, false);
  assert.equal(readFileSync(join(work, 'out/INPUTS'), 'utf8').trim(), inputsDigest(kind.dir, manifest));
  assert.ok(builtFrom(first.out, manifest, first.digest));
  assert.equal(buildKind({ kind, work, log: quiet }).reused, true);
  assert.equal(runs(work), 1);
  buildKind({ kind, work, force: true, log: quiet });
  assert.equal(runs(work), 2);
});

test('changed sources are built again', (t) => {
  const { root, kind } = fakeKind(t);
  const work = join(root, 'work');
  buildKind({ kind, work, log: quiet });
  writeFileSync(join(kind.dir, 'build/pins.env'), 'DEMO_VERSION=2\n');
  assert.equal(buildKind({ kind, work, log: quiet }).reused, false);
});

test('ci/sources.sh runs once per workdir, before build.sh', (t) => {
  const { root, kind } = fakeKind(t, { sources: true });
  const work = join(root, 'work');
  buildKind({ kind, work, log: quiet });
  buildKind({ kind, work, force: true, log: quiet });
  assert.equal(runs(work, 'sources'), 1);
});

test('a failing build.sh leaves no INPUTS', (t) => {
  const { root, kind } = fakeKind(t);
  writeFileSync(join(kind.dir, 'build/build.sh'), 'mkdir -p "$1/out"; exit 3\n');
  const work = join(root, 'work');
  assert.throws(() => buildKind({ kind, work, log: quiet }), /BUILD FAIL: .*exited 3/);
  assert.ok(!existsSync(join(work, 'out/INPUTS')));
});

test('the default workdir is per set of sources under dist/agents/<id>/', () => {
  assert.equal(defaultWork('/r', 'opencode', 'abcdef0123456789'), '/r/dist/agents/opencode/abcdef012345');
});
