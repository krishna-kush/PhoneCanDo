// gh.mjs over a fake runner: what it asks GitHub and how it reads answers.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeGh } from './gh.mjs';

const REPO = 'krishna-kush/PhoneCanDo';
const SHA = 'a872e7b186c5560d021286a5ee3133ba28db01a3';
const ok = (stdout) => ({ status: 0, stdout, stderr: '' });
const httpError = (code, message) => ({ status: 1, stdout: '{"message":"x"}', stderr: `gh: ${message} (HTTP ${code})\n` });

/** A runner that answers by the longest matching API path prefix and records every argv. */
function fakeRun(answers) {
  const calls = [];
  const prefixes = Object.keys(answers).sort((a, b) => b.length - a.length);
  const run = (args) => {
    calls.push(args);
    const path = args.find((arg) => arg.startsWith('repos/'));
    const key = prefixes.find((prefix) => path.startsWith(prefix));
    return key ? answers[key] : httpError(404, 'Not Found');
  };
  return { run, calls };
}

test('commitState: present, or missing on 422/404', () => {
  assert.equal(makeGh(fakeRun({ [`repos/${REPO}/commits/`]: ok(`${SHA}\n`) })).commitState(REPO, SHA), 'present');
  const unpushed = fakeRun({ [`repos/${REPO}/commits/`]: httpError(422, `No commit found for SHA: ${SHA}`) });
  assert.equal(makeGh(unpushed).commitState(REPO, SHA), 'missing');
  assert.equal(makeGh(fakeRun({})).commitState(REPO, SHA), 'missing');
});

test('commitState: any other failure throws instead of guessing', () => {
  const auth = fakeRun({ [`repos/${REPO}/commits/`]: httpError(401, 'Bad credentials') });
  assert.throws(() => makeGh(auth).commitState(REPO, SHA), /Bad credentials \(HTTP 401\)/);
  const noGh = { run: () => ({ status: null, stdout: '', stderr: '', error: new Error('spawn gh ENOENT') }) };
  assert.throws(() => makeGh(noGh).commitState(REPO, SHA), /ENOENT/);
});

test('ciState: every list paginated, one JSON object per line', () => {
  const fake = fakeRun({
    [`repos/${REPO}/commits/${SHA}/check-runs`]: ok('{"id":1,"name":"ci-ok"}\n{"id":2,"name":"lint-ok"}\n'),
    [`repos/${REPO}/actions/runs`]: ok('{"id":9,"path":".github/workflows/ci.yml"}\n'),
    [`repos/${REPO}/commits/${SHA}/status`]: ok(''),
  });
  const state = makeGh(fake).ciState(REPO, SHA);
  assert.deepEqual(state.checkRuns.map((c) => c.name), ['ci-ok', 'lint-ok']);
  assert.equal(state.workflowRuns[0].id, 9);
  assert.deepEqual(state.statuses, []);
  for (const args of fake.calls) assert.ok(args.includes('--paginate'), args.join(' '));
});

test('ciState: a failed page throws', () => {
  const fake = fakeRun({ [`repos/${REPO}/commits/${SHA}/check-runs`]: httpError(502, 'Bad Gateway') });
  assert.throws(() => makeGh(fake).ciState(REPO, SHA), /Bad Gateway/);
});

test('runState: the run, or missing on 404', () => {
  const run = { path: '.github/workflows/lre-image.yml', status: 'completed', conclusion: 'success', branch: 'prod', url: 'u' };
  const fake = fakeRun({ [`repos/${REPO}/actions/runs/42`]: ok(`${JSON.stringify(run)}\n`) });
  assert.deepEqual(makeGh(fake).runState(REPO, 42), run);
  assert.equal(makeGh(fakeRun({})).runState(REPO, 42), 'missing');
  const auth = fakeRun({ [`repos/${REPO}/actions/runs/42`]: httpError(401, 'Bad credentials') });
  assert.throws(() => makeGh(auth).runState(REPO, 42), /Bad credentials/);
});

test('releaseState: the published release by tag, or missing on 404', () => {
  const release = { draft: false, prerelease: true, assets: [{ name: 'a.tar.xz', size: 3 }] };
  const fake = fakeRun({ [`repos/${REPO}/releases/tags/linux-image-x`]: ok(`${JSON.stringify(release)}\n`) });
  assert.deepEqual(makeGh(fake).releaseState(REPO, 'linux-image-x'), release);
  assert.equal(makeGh(fakeRun({})).releaseState(REPO, 'linux-image-x'), 'missing');
  const down = fakeRun({ [`repos/${REPO}/releases/tags/`]: httpError(502, 'Bad Gateway') });
  assert.throws(() => makeGh(down).releaseState(REPO, 'linux-image-x'), /Bad Gateway/);
});

const UP = 'termux/proot';
const PIN = '52d65a4dc140ca554d241a1438ddd4f6b00c9813';

test('upstreamLag: the default branch, then the compare counts from our pin to it', () => {
  const fake = fakeRun({
    [`repos/${UP}`]: ok('{"branch":"master"}\n'),
    [`repos/${UP}/compare/`]: ok('{"newer":7,"offBranch":0}\n'),
  });
  assert.deepEqual(makeGh(fake).upstreamLag(UP, PIN), { branch: 'master', newer: 7, offBranch: 0 });
  assert.equal(fake.calls[1].find((arg) => arg.startsWith('repos/')), `repos/${UP}/compare/${PIN}...master`);
  assert.ok(!fake.calls[1].includes('--paginate'), 'the counts come whole on one page');
});

test('upstreamLag: a GitHub that cannot be read throws', () => {
  const down = fakeRun({
    [`repos/${UP}`]: ok('{"branch":"master"}\n'),
    [`repos/${UP}/compare/`]: httpError(502, 'Bad Gateway'),
  });
  assert.throws(() => makeGh(down).upstreamLag(UP, PIN), /Bad Gateway/);
  assert.throws(() => makeGh(fakeRun({})).upstreamLag(UP, PIN));
});

test('only ever reads: plain `gh api` GETs, no method, field or input flags', () => {
  const fake = fakeRun({
    [`repos/${REPO}/commits/`]: ok(`${SHA}\n`),
    [`repos/${REPO}/commits/${SHA}/check-runs`]: ok(''),
    [`repos/${REPO}/commits/${SHA}/status`]: ok(''),
    [`repos/${REPO}/actions/runs`]: ok(''),
    [`repos/${REPO}/actions/runs/42`]: ok('{}'),
    [`repos/${REPO}/releases/tags/`]: ok('{}'),
    [`repos/${UP}`]: ok('{"branch":"master"}'),
    [`repos/${UP}/compare/`]: ok('{"newer":0,"offBranch":0}'),
  });
  const gh = makeGh(fake);
  gh.commitState(REPO, SHA);
  gh.ciState(REPO, SHA);
  gh.runState(REPO, 42);
  gh.releaseState(REPO, 'linux-image-x');
  gh.upstreamLag(UP, PIN);
  assert.equal(fake.calls.length, 8);
  for (const args of fake.calls) {
    assert.equal(args[0], 'api');
    for (const flag of ['-X', '--method', '-f', '-F', '--field', '--raw-field', '--input']) {
      assert.ok(!args.includes(flag), `${flag} in ${args.join(' ')}`);
    }
  }
});
