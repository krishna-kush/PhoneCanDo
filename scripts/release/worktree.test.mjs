// Working-tree decisions on porcelain listings (never a real repo).
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dirtyEntries, parsePorcelain } from './worktree.mjs';

const VERSION_FILES = ['app/app.json', 'app/package.json', 'app/src/engine/updates.ts'];
const z = (...records) => `${records.join('\0')}\0`;

test('parses -z records, renames with their source, paths with spaces', () => {
  assert.deepEqual(parsePorcelain(z(' M app/app.json', '?? docs/new file.md', 'R  b.mjs', 'a.mjs', 'D  gone.txt')), [
    { code: ' M', path: 'app/app.json' },
    { code: '??', path: 'docs/new file.md' },
    { code: 'R ', path: 'b.mjs', from: 'a.mjs' },
    { code: 'D ', path: 'gone.txt' },
  ]);
  assert.deepEqual(parsePorcelain(''), []);
});

test('clean tree: nothing stops the release', () => {
  assert.deepEqual(dirtyEntries(parsePorcelain('')), []);
});

test('any change stops a normal release, version files included', () => {
  const entries = parsePorcelain(z(' M app/app.json', '?? scratch.txt'));
  assert.deepEqual(dirtyEntries(entries).map((e) => e.path), ['app/app.json', 'scratch.txt']);
});

test('upload-only: the three version files may be edited in place, staged or not', () => {
  const entries = parsePorcelain(z(' M app/app.json', 'M  app/package.json', 'MM app/src/engine/updates.ts'));
  assert.deepEqual(dirtyEntries(entries, VERSION_FILES), []);
});

test('upload-only: anything beyond the version files, or not an in-place edit, still counts', () => {
  const entries = parsePorcelain(z(' M app/app.json', ' M app/src/ui/chat/Chat.tsx', ' D app/package.json', 'UU app/src/engine/updates.ts'));
  assert.deepEqual(dirtyEntries(entries, VERSION_FILES).map((e) => `${e.code} ${e.path}`), [
    ' M app/src/ui/chat/Chat.tsx',
    ' D app/package.json',
    'UU app/src/engine/updates.ts',
  ]);
  const renamed = parsePorcelain(z('R  app/app.json', 'app/app.old.json'));
  assert.equal(dirtyEntries(renamed, VERSION_FILES).length, 1);
});
