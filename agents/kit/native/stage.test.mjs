// stage.mjs: copy, rename and chmod per payload.libs, and the linkage guard.
//   node --test agents/kit/native/stage.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { defaultDest, stagePayload } from './stage.mjs';

const manifest = {
  id: 'demo',
  payload: {
    libs: [
      { name: 'libdm-engine.so', from: 'demo.bin', role: 'engine', linkage: 'system-only' },
      { name: 'libdm-ui.so', from: 'libui.so', role: 'ui', linkage: 'system-only' },
    ],
  },
};
const quiet = () => {};

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'stage-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('copies each lib from its build name to its packaged name, mode 755', (t) => {
  const dir = scratch(t);
  writeFileSync(join(dir, 'demo.bin'), 'engine bytes');
  writeFileSync(join(dir, 'libui.so'), 'ui');
  const dest = join(dir, 'libs');
  const out = stagePayload({ manifest, from: dir, dest, checkLinkage: false, log: quiet });
  assert.deepEqual(out.map((o) => [o.name, o.bytes]), [['libdm-engine.so', 12], ['libdm-ui.so', 2]]);
  assert.equal(readFileSync(join(dest, 'libdm-engine.so'), 'utf8'), 'engine bytes');
  for (const { path } of out) assert.equal(statSync(path).mode & 0o777, 0o755);
});

test('--staged reads the packaged names (a downloaded payload artifact)', (t) => {
  const dir = scratch(t);
  writeFileSync(join(dir, 'libdm-engine.so'), 'e');
  writeFileSync(join(dir, 'libdm-ui.so'), 'u');
  const out = stagePayload({ manifest, from: dir, dest: join(dir, 'libs'), staged: true, checkLinkage: false, log: quiet });
  assert.equal(out.length, 2);
});

test('a missing build output fails before anything is copied', (t) => {
  const dir = scratch(t);
  writeFileSync(join(dir, 'demo.bin'), 'e');
  const dest = join(dir, 'libs');
  assert.throws(
    () => stagePayload({ manifest, from: dir, dest, checkLinkage: false, log: quiet }),
    /STAGE FAIL: .*libui\.so missing \(run \.\/manage agent demo build first\)/,
  );
  assert.throws(() => statSync(dest));
});

test('a manifest without payload.libs fails', () => {
  assert.throws(() => stagePayload({ manifest: { id: 'x' }, from: '.', dest: '.', log: quiet }), /no payload\.libs/);
});

test('default dest is the per-kind libs dir the runner build reads', () => {
  assert.equal(defaultDest('/r', 'opencode'), '/r/app/modules/phonecando-runner/android/src/agents/opencode/libs/arm64-v8a');
});

const hasReadelf = spawnSync('readelf', ['--version']).status === 0;

test('the linkage guard refuses a file that is not ELF', { skip: !hasReadelf && 'no readelf' }, (t) => {
  const dir = scratch(t);
  writeFileSync(join(dir, 'demo.bin'), 'not elf');
  writeFileSync(join(dir, 'libui.so'), 'not elf');
  assert.throws(
    () => stagePayload({ manifest, from: dir, dest: join(dir, 'libs'), log: quiet }),
    /STAGE FAIL: libdm-engine\.so failed the linkage guard/,
  );
});

test('the linkage guard refuses a host (glibc) binary', { skip: !hasReadelf && 'no readelf' }, (t) => {
  const dir = scratch(t);
  const host = realpathSync('/bin/sh');
  const one = { id: 'demo', payload: { libs: [{ name: 'libdm-engine.so', from: host, role: 'engine', linkage: 'system-only' }] } };
  assert.throws(
    () => stagePayload({ manifest: one, from: '/', dest: join(dir, 'libs'), log: quiet }),
    /failed the linkage guard/,
  );
});
