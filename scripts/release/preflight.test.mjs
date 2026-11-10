// The whole preflight on fakes: git and gh are plain objects here, so no
// test ever spawns git or reaches GitHub.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fakeLinux, NOT_STAGED, okProot, okRelease, okRun, RELEASE, RUN_ID } from './linux/fixtures.mjs';
import { runPreflight } from './preflight.mjs';
import { preflightReport } from './report.mjs';

const REPO = 'krishna-kush/PhoneCanDo';
const VERSION_FILES = ['app/app.json', 'app/package.json', 'app/src/engine/updates.ts'];
const loadCi = () => JSON.parse(readFileSync(new URL('./ci/fixtures/prod-a872e7b.json', import.meta.url), 'utf8'));
const SHA = loadCi().sha;

const fakeGit = ({ head = SHA, porcelain = '' } = {}) => ({ head: () => head, porcelain: () => porcelain });

/**
 * gh that has `commits`, answers ciState with `ci` and the image lock's run
 * and release with `run` and `release`; records what it was asked.
 */
function fakeGh({ commits = [SHA], ci = loadCi(), run = okRun(), release = okRelease() } = {}) {
  const asked = [];
  return {
    asked,
    commitState(repo, sha) {
      asked.push(['commit', repo, sha]);
      return commits.includes(sha) ? 'present' : 'missing';
    },
    ciState(repo, sha) {
      asked.push(['ci', repo, sha]);
      return ci;
    },
    runState(repo, id) {
      asked.push(['run', repo, id]);
      return run;
    },
    releaseState(repo, tag) {
      asked.push(['release', repo, tag]);
      return release;
    },
  };
}

function redCi(name = 'ci-ok') {
  const ci = loadCi();
  Object.assign(ci.checkRuns.find((c) => c.name === name), { status: 'completed', conclusion: 'failure' });
  return ci;
}

const preflight = (over = {}) =>
  runPreflight({ git: fakeGit(), gh: fakeGh(), linux: fakeLinux(), repo: REPO, allowDirty: [], overrides: [], ...over });

test('clean, pushed, green, Linux verified: go, and the report says so', () => {
  const gh = fakeGh();
  const result = preflight({ gh });
  assert.equal(result.proceed, true);
  assert.equal(result.sha, SHA);
  assert.deepEqual(result.gates.map((g) => [g.id, g.ok]), [
    ['tree', true],
    ['pushed', true],
    ['ci', true],
    ['proot', true],
    ['image', true],
  ]);
  assert.deepEqual(result.notes, []);
  assert.deepEqual(gh.asked, [
    ['commit', REPO, SHA],
    ['ci', REPO, SHA],
    ['run', REPO, RUN_ID],
    ['release', REPO, RELEASE],
  ]);
  assert.equal(result.proot.version, '5.1.107.102');
  assert.equal(result.image.release, RELEASE);
  const text = preflightReport(result).join('\n');
  assert.match(text, /CHECK\s+WORKFLOW\s+STATE\s+ROLE\s+DECISION\s+NOTE/);
  assert.match(text, /ci-ok\s+CI\s+success\s+required gate\s+ok/);
  assert.match(text, /pce-ok\s+pce\.yml\s+not run\s+gate\s+warn\s+workflow did not run/);
  assert.match(text, /proot\s+ok: proot 5\.1\.107\.102 staged/);
  assert.match(text, /Image\s+ok: Default image 20261107-e541287e is the locked one/);
  assert.match(text, /Preflight passed\.$/);
});

test('Linux refusals are never overridden by --allow-red-ci, and get no red-CI hint', () => {
  const staged = okProot();
  staged.libs['libproot.so'].sha256 = 'f'.repeat(64);
  const result = preflight({ linux: fakeLinux({ proot: staged }), overrides: ['ci'] });
  assert.equal(result.proceed, false);
  assert.deepEqual(result.overridden, []);
  assert.match(result.refusals[0], /^proot: libproot\.so is not the verified build/);
  assert.equal(result.proot, null);
  const text = preflightReport(result).join('\n');
  assert.match(text, /proot\s+REFUSED/);
  assert.doesNotMatch(text, /--allow-red-ci/);
});

test('nothing Linux staged: refused twice; --without-linux lets it go with none', () => {
  const bare = () =>
    fakeLinux({ proot: { libs: { 'libproot.so': null, 'libproot-loader.so': null }, sums: null, version: '5.1.107.102', marked: false }, image: NOT_STAGED });
  const refused = preflight({ linux: bare() });
  assert.equal(refused.proceed, false);
  assert.deepEqual(refused.refusals.map((r) => r.split(':')[0]), ['proot', 'Image']);
  const gh = fakeGh();
  const without = preflight({ linux: bare(), gh, withoutLinux: true });
  assert.equal(without.proceed, true);
  assert.deepEqual([without.proot, without.image], [null, null]);
  assert.deepEqual(gh.asked.map(([what]) => what), ['commit', 'ci'], 'no image lookups for no image');
});

test('the image lock run turned red: refused', () => {
  const result = preflight({ gh: fakeGh({ run: okRun({ conclusion: 'failure' }) }) });
  assert.equal(result.proceed, false);
  assert.match(result.refusals[0], /^Image: lock\.json's lre-image run \d+ is failure, not green/);
});

test('dirty tree: refused, never overridable, and CI is still shown', () => {
  const git = fakeGit({ porcelain: ' M app/src/ui/chat/Chat.tsx\0?? notes.txt\0' });
  const result = preflight({ git, overrides: ['ci'] });
  assert.equal(result.proceed, false);
  assert.equal(result.refusals.length, 1);
  assert.match(result.refusals[0], /^Tree: 2 uncommitted change/);
  assert.ok(result.ci, 'the CI table is still computed');
  const text = preflightReport(result).join('\n');
  assert.match(text, /Tree\s+REFUSED/);
  assert.match(text, / M app\/src\/ui\/chat\/Chat\.tsx/);
  assert.doesNotMatch(text, /--allow-red-ci/, 'no override hint for a dirty tree');
});

test('upload-only: the three bumped version files are allowed', () => {
  const git = fakeGit({ porcelain: ' M app/app.json\0 M app/package.json\0 M app/src/engine/updates.ts\0' });
  const result = preflight({ git, allowDirty: VERSION_FILES });
  assert.equal(result.proceed, true);
  assert.match(result.gates[0].summary, /^clean \(version files may differ/);
});

test('upload-only: a fourth changed file is still refused', () => {
  const git = fakeGit({ porcelain: ' M app/app.json\0 M app/App.tsx\0' });
  const result = preflight({ git, allowDirty: VERSION_FILES });
  assert.equal(result.proceed, false);
  assert.deepEqual(result.gates[0].detail, [' M app/App.tsx']);
});

test('unpushed commit: refused, never overridable, and no CI lookup', () => {
  const gh = fakeGh({ commits: [] });
  const result = preflight({ gh, overrides: ['ci'] });
  assert.equal(result.proceed, false);
  assert.match(result.refusals[0], /^GitHub: krishna-kush\/PhoneCanDo does not have [0-9a-f]{12}; push it first$/);
  assert.equal(result.ci, undefined);
  assert.deepEqual(gh.asked.map(([what]) => what), ['commit', 'run', 'release'], 'no CI lookup; the image gate still runs');
});

test('red CI without the override: refused, with the hint', () => {
  const result = preflight({ gh: fakeGh({ ci: redCi() }) });
  assert.equal(result.proceed, false);
  assert.deepEqual(result.refusals, ['CI: not green: ci-ok (failure); 10 warning(s)']);
  const text = preflightReport(result).join('\n');
  assert.match(text, /ci-ok\s+CI\s+failure\s+required gate\s+BLOCK/);
  assert.match(text, /overridden with --allow-red-ci/);
});

test('red CI with --allow-red-ci: goes on, and the release notes record it', () => {
  const result = preflight({ gh: fakeGh({ ci: redCi('lint-ok') }), overrides: ['ci'] });
  assert.equal(result.proceed, true);
  assert.deepEqual(result.overridden, ['ci']);
  assert.deepEqual(result.notes, ['Released with red CI: lint-ok (failure)']);
  const text = preflightReport(result).join('\n');
  assert.match(text, /CI\s+OVERRIDDEN: not green: lint-ok \(failure\)/);
  assert.match(text, /release notes will end with:\n {2}Released with red CI: lint-ok \(failure\)$/);
});

test('--allow-red-ci on green CI adds no note', () => {
  const result = preflight({ overrides: ['ci'] });
  assert.equal(result.proceed, true);
  assert.deepEqual(result.notes, []);
});

test('upload-only after HEAD moved: the staged commit is checked and released', () => {
  const head = 'f'.repeat(40);
  const gh = fakeGh();
  const result = preflight({ git: fakeGit({ head }), gh, builtFrom: SHA });
  assert.equal(result.sha, SHA);
  assert.equal(result.head, head);
  const commitAsks = gh.asked.filter(([what]) => what === 'commit' || what === 'ci');
  assert.deepEqual(commitAsks.map(([, , sha]) => sha), [SHA, SHA]);
  assert.match(preflightReport(result)[0], /the staged APKs' commit; HEAD is ffffffffffff/);
});
