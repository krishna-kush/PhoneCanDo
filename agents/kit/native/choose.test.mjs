// choose.mjs: staged first, GitHub next, a build on this PC last.
//   node --test agents/kit/native/choose.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { choose } from './choose.mjs';

const BUILD = { runId: 7, sha: 'abc1234', created: '2026-11-15T04:02:00Z', expires: '2026-11-29T04:02:00Z' };
const current = (source = 'github run 7 abc1234') => ({ state: 'current', why: [], source });
const outdated = { state: 'outdated', why: ['no INPUTS: built from unknown sources'], source: null };
const kind = (staged, builds = [BUILD]) => ({ id: 'demo', staged, builds });
const picked = ({ actions, pick }) => actions[pick]?.action;

test('a current payload is kept; GitHub and a build stay on offer', () => {
  const choice = choose(kind(current()));
  assert.equal(picked(choice), 'keep');
  assert.deepEqual(choice.actions.map((a) => a.action), ['keep', 'download', 'build']);
});

test('an outdated payload takes GitHub\'s build, or a build when GitHub has none', () => {
  assert.equal(picked(choose(kind(outdated))), 'download');
  assert.equal(picked(choose(kind(outdated, []))), 'build');
  assert.equal(picked(choose(kind({ state: 'missing', why: [], source: null }, null))), 'build');
});

test('a release prefers GitHub\'s build over a current one built on this PC', () => {
  const local = kind(current('built on this PC 2026-11-15'));
  assert.equal(picked(choose(local)), 'keep');
  const release = choose(local, { release: true });
  assert.equal(picked(release), 'download');
  assert.match(release.note, /built on this PC/);
  assert.equal(picked(choose(kind(current('built on this PC 2026-11-15'), []), { release: true })), 'keep');
  assert.equal(picked(choose(kind(current()), { release: true })), 'keep');
});

test('--rebuild builds even a current payload; --download takes GitHub\'s', () => {
  const rebuild = choose(kind(current()), { rebuild: new Set(['demo']) });
  assert.equal(picked(rebuild), 'build');
  assert.ok(!rebuild.actions.some((a) => a.action === 'keep'));
  assert.equal(picked(choose(kind(current()), { download: new Set(['demo']) })), 'download');
});

test('--download with no GitHub build cannot be met', () => {
  const none = choose(kind(outdated, []), { download: new Set(['demo']) });
  assert.equal(none.pick, -1);
  assert.match(none.note, /no trusted build of these sources/);
  assert.match(choose(kind(outdated, null), { download: new Set(['demo']) }).note, /could not be asked/);
});
