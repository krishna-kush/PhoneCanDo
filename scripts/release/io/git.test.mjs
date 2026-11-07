// git.mjs over a fake runner: no test spawns git.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeGit } from './git.mjs';

const SHA = 'a872e7b186c5560d021286a5ee3133ba28db01a3';

function fakeRun(answer) {
  const calls = [];
  return { calls, run: (args) => (calls.push(args), answer) };
}

test('head: the full commit id, verified', () => {
  const fake = fakeRun({ status: 0, stdout: `${SHA}\n`, stderr: '' });
  assert.equal(makeGit(fake).head(), SHA);
  assert.deepEqual(fake.calls, [['rev-parse', '--verify', 'HEAD']]);
});

test('head: no repo or odd output throws', () => {
  const noRepo = fakeRun({ status: 128, stdout: '', stderr: 'fatal: not a git repository\n' });
  assert.throws(() => makeGit(noRepo).head(), /not a git repository/);
  assert.throws(() => makeGit(fakeRun({ status: 0, stdout: 'HEAD\n', stderr: '' })).head(), /unexpected output/);
});

test('porcelain: a read-only status listing, untracked files one by one', () => {
  const fake = fakeRun({ status: 0, stdout: ' M app/app.json\0', stderr: '' });
  assert.equal(makeGit(fake).porcelain(), ' M app/app.json\0');
  assert.deepEqual(fake.calls, [['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all']]);
});

test('the only commands it runs are rev-parse and status', () => {
  const fake = fakeRun({ status: 0, stdout: `${SHA}\n`, stderr: '' });
  const git = makeGit(fake);
  git.head();
  git.porcelain();
  const subcommands = fake.calls.map((args) => args.find((arg) => !arg.startsWith('-')));
  assert.deepEqual(subcommands, ['rev-parse', 'status']);
});
