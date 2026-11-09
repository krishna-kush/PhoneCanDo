// new.mjs: scaffolds from templates/, valid at birth, refuses what it must.
//   node --test agents/kit/cli/new.test.mjs
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { scanManifests } from './manifests.mjs';
import { main, scaffold } from './new.mjs';

function root(t) {
  const dir = mkdtempSync(join(tmpdir(), 'new-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('a native kind: filled-in manifest, executable scripts, clean folder rules', (t) => {
  const r = root(t);
  const written = scaffold({ id: 'demo-cli', type: 'native', root: r });
  assert.ok(written.includes('agents/native/demo-cli/agent.json'));
  assert.ok(written.includes('agents/native/demo-cli/build/build.sh'));
  const manifest = JSON.parse(readFileSync(join(r, 'agents/native/demo-cli/agent.json'), 'utf8'));
  assert.equal(manifest.id, 'demo-cli');
  assert.equal(manifest.prefix, 'democli');
  assert.equal(manifest.payload.libs[0].name, 'libdemocli-engine.so');
  assert.equal(statSync(join(r, 'agents/native/demo-cli/build/build.sh')).mode & 0o111, 0o111);
  assert.ok(!readFileSync(join(r, 'agents/native/demo-cli/README.md'), 'utf8').includes('__'));
  assert.deepEqual(scanManifests({ root: r }).problems, []);
});

test('an image kind, and --prefix for a native one', (t) => {
  const r = root(t);
  scaffold({ id: 'helper', type: 'image', root: r });
  scaffold({ id: 'coder', type: 'native', prefix: 'cd', root: r });
  const { entries, problems } = scanManifests({ root: r });
  assert.deepEqual(problems, []);
  assert.deepEqual(entries.map((e) => [e.type, e.id, e.manifest.prefix ?? null]), [['native', 'coder', 'cd'], ['image', 'helper', null]]);
});

test('refuses reserved, malformed and taken ids and prefixes', (t) => {
  const r = root(t);
  assert.throws(() => scaffold({ id: 'kit', type: 'image', root: r }), /reserved/);
  assert.throws(() => scaffold({ id: 'Bad_Id', type: 'image', root: r }), /must match/);
  assert.throws(() => scaffold({ id: 'llama', type: 'native', root: r }), /prefix "llama" is reserved/);
  assert.throws(() => scaffold({ id: 'img', type: 'image', prefix: 'x', root: r }), /native kinds only/);
  scaffold({ id: 'one', type: 'native', prefix: 'on', root: r });
  assert.throws(() => scaffold({ id: 'one', type: 'image', root: r }), /id "one" is taken/);
  assert.throws(() => scaffold({ id: 'two', type: 'native', prefix: 'on', root: r }), /prefix "on" is one's/);
  mkdirSync(join(r, 'agents/image/three'), { recursive: true });
  writeFileSync(join(r, 'agents/image/three/.keep'), '');
  assert.throws(() => scaffold({ id: 'three', type: 'image', root: r }), /already exists/);
});

test('CLI: usage errors exit 2, refusals 1', (t) => {
  const r = root(t);
  const quiet = { log: () => {}, error: () => {} };
  assert.equal(main(['x'], quiet), 2);
  assert.equal(main(['x', '--native', '--image'], quiet), 2);
  assert.equal(main(['new', '--image', '--root', r], quiet), 1);
  assert.equal(main(['fresh', '--image', '--root', r], quiet), 0);
});
