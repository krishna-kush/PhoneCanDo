// A workflow that did not run on the release commit, judged by its last
// earlier run: the real fixtures, a872e7b as the release (Web ran, Android
// did not) and 2e1fc17 as the commit before it where Android ran.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifyChecks } from './classify.mjs';
import { makeLookBack, releaseBranch } from './earlier.mjs';

const REPO = 'krishna-kush/PhoneCanDo';
const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
// The fixtures predate the branch field; the release's push runs were on prod.
const onProd = (fx) => {
  for (const run of fx.workflowRuns) run.branch = 'prod';
  return fx;
};
const release = () => onProd(load('prod-a872e7b'));
const before = () => onProd(load('prod-2e1fc17'));
const SHA = release().sha;
const EARLIER = before().sha;

/**
 * gh whose prod has `runs` per workflow file (newest first), whose commits
 * `inside` the release are contained in it, and whose ciState answers
 * `states` by commit; records what it was asked.
 */
function fakeGh({ runs = {}, inside = [EARLIER], states = { [EARLIER]: before() } } = {}) {
  const asked = [];
  return {
    asked,
    branchRuns(repo, file, branch) {
      asked.push(['runs', file, branch]);
      return runs[file] ?? [];
    },
    contains(repo, older, sha) {
      asked.push(['contains', older, sha]);
      return inside.includes(older);
    },
    ciState(repo, sha) {
      asked.push(['ci', sha]);
      return typeof states[sha] === 'function' ? states[sha]() : states[sha];
    },
  };
}
const androidRun = (head_sha = EARLIER) => ({ id: 1, head_sha, status: 'completed', conclusion: 'success', created_at: '2026-11-07T00:00:00Z' });
const lookBack = (gh, raw = release()) => makeLookBack(gh, REPO)(SHA, raw, classifyChecks(raw));
const row = (ci, name) => ci.rows.find((r) => r.name === name);

function redAndroid() {
  const fx = before();
  Object.assign(fx.checkRuns.find((c) => c.name === 'Debug APK (play)'), { status: 'completed', conclusion: 'failure' });
  return fx;
}

test('the release branch is its push runs', () => {
  assert.equal(releaseBranch(release().workflowRuns), 'prod');
  assert.equal(releaseBranch(load('prod-a872e7b').workflowRuns), null);
});

test('green on the commit before: the skipped workflow is ok, not a warning', () => {
  const ci = lookBack(fakeGh({ runs: { 'android.yml': [androidRun()] } }));
  const android = row(ci, '(all jobs)');
  assert.equal(android.decision, 'ok');
  assert.match(android.note, /green on 2e1fc17/);
  assert.deepEqual(ci.blocks, []);
});

test('red on the commit before: the release is blocked for it', () => {
  const ci = lookBack(fakeGh({ runs: { 'android.yml': [androidRun()] }, states: { [EARLIER]: redAndroid() } }));
  const android = row(ci, '(all jobs)');
  assert.equal(android.decision, 'block');
  assert.equal(android.state, 'failure');
  assert.match(android.note, /on 2e1fc17: Debug APK \(play\) failure/);
  assert.deepEqual(ci.blocks.map((r) => r.name), ['(all jobs)']);
});

test('never ran on the branch: still only a warning, saying so', () => {
  const ci = lookBack(fakeGh());
  const pce = row(ci, 'pce-ok');
  assert.equal(pce.decision, 'warn');
  assert.match(pce.note, /nor before on prod/);
});

test('a newer run on a commit the release lacks is passed over', () => {
  const later = androidRun('f'.repeat(40));
  const gh = fakeGh({ runs: { 'android.yml': [later, androidRun()] }, states: { [EARLIER]: redAndroid() } });
  assert.equal(row(lookBack(gh), '(all jobs)').decision, 'block');
  assert.ok(!gh.asked.some(([what, sha]) => what === 'ci' && sha === later.head_sha));
});

test('no branch to look on (no push run): the rows are as classified, GitHub not asked', () => {
  const raw = load('prod-a872e7b');
  const gh = fakeGh({ runs: { 'android.yml': [androidRun()] } });
  const ci = makeLookBack(gh, REPO)(SHA, raw, classifyChecks(raw));
  assert.deepEqual(ci, classifyChecks(raw));
  assert.deepEqual(gh.asked, []);
});

test('a finished verdict is kept; a run still going is read again on the next poll', () => {
  let going = true;
  const running = () => {
    const fx = before();
    if (going) Object.assign(fx.checkRuns.find((c) => c.name === 'Debug APK (play)'), { status: 'in_progress', conclusion: null });
    return fx;
  };
  const gh = fakeGh({ runs: { 'android.yml': [androidRun()] }, states: { [EARLIER]: running } });
  const look = makeLookBack(gh, REPO);
  const raw = release();
  const first = look(SHA, raw, classifyChecks(raw));
  assert.equal(row(first, '(all jobs)').state, 'in_progress');
  assert.equal(row(first, '(all jobs)').decision, 'block');
  going = false;
  const second = look(SHA, raw, classifyChecks(raw));
  assert.equal(row(second, '(all jobs)').decision, 'ok');
  const asked = gh.asked.length;
  look(SHA, raw, classifyChecks(raw));
  assert.equal(gh.asked.length, asked, 'nothing asked once every verdict is final');
});
