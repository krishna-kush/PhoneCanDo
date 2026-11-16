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

// A runner answering each subcommand from `answers` (status 0 and no
// output for the rest).
function scriptedRun(answers) {
  const calls = [];
  const run = (args) => {
    calls.push(args);
    const sub = args.find((arg) => !arg.startsWith('-'));
    return { status: 0, stdout: '', stderr: '', ...answers[sub] };
  };
  return { calls, run };
}

test('changedSince: the files between two commits', () => {
  const fake = scriptedRun({ diff: { stdout: 'pce/a.kt\0tce/b.ts\0' } });
  assert.deepEqual(makeGit(fake).changedSince('aaa', SHA), { state: 'ok', files: ['pce/a.kt', 'tce/b.ts'] });
  assert.deepEqual(fake.calls.at(-1), ['diff', '--name-only', '-z', 'aaa', SHA]);
});

test('changedSince: a commit this clone lacks, or one not behind, is said so', () => {
  assert.deepEqual(makeGit(scriptedRun({ 'cat-file': { status: 1 } })).changedSince('aaa', SHA), { state: 'missing' });
  assert.deepEqual(makeGit(scriptedRun({ 'merge-base': { status: 1 } })).changedSince('aaa', SHA), { state: 'diverged' });
  assert.throws(
    () => makeGit(scriptedRun({ 'merge-base': { status: 128, stderr: 'boom' } })).changedSince('aaa', SHA),
    /boom/,
  );
});

test('the only commands it runs are reads', () => {
  const fake = scriptedRun({ 'rev-parse': { stdout: `${SHA}\n` } });
  const git = makeGit(fake);
  git.head();
  git.porcelain();
  git.changedSince('aaa', SHA);
  const subcommands = fake.calls.map((args) => args.find((arg) => !arg.startsWith('-')));
  assert.deepEqual(subcommands, ['rev-parse', 'status', 'cat-file', 'merge-base', 'diff']);
});
