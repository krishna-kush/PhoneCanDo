// Release CI gate decisions on real check runs (fixtures/, fetched read-only
// from GitHub for two prod commits) and on crafted edits of them.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifyChecks } from './classify.mjs';

// a872e7b: CI, Lint, Web, TCE ran (no Android, PCE, LRE, proot, agents, payload).
// 2e1fc17: CI, Lint, TCE, Android and the opencode payload ran (no Web). Its
// payload run is renamed to what agent-payload.yml (once oc-payload.yml) runs:
// plan, check/drift/build/contract (opencode).
const load = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'));
const web = () => load('prod-a872e7b');
const android = () => load('prod-2e1fc17');

/** Patches the one check run called `name` (it must exist). */
function patch(fx, name, fields) {
  const check = fx.checkRuns.find((c) => c.name === name);
  assert.ok(check, `fixture has no check run "${name}"`);
  Object.assign(check, fields);
  return fx;
}
const red = { status: 'completed', conclusion: 'failure' };
const row = (result, name) => result.rows.find((r) => r.name === name);
const names = (rows) => rows.map((r) => r.name).sort();

test('real prod commit, all green: nothing blocks; workflows that did not run only warn', () => {
  const result = classifyChecks(web());
  assert.deepEqual(result.blocks, []);
  assert.deepEqual(names(result.warns), ['(all jobs)', 'agents-ok', 'llamacpp-ok', 'lme-ok', 'local-models-ok', 'lre-compat-ok', 'lre-image-ok', 'lre-ok', 'pce-ok', 'proot-ok']);
  for (const gate of ['ci-ok', 'lint-ok', 'web-ok', 'tce-ok']) assert.equal(row(result, gate).decision, 'ok', gate);
  assert.equal(row(result, 'ci-ok').role, 'required gate');
  assert.equal(row(result, 'pce-ok').state, 'not run');
  assert.match(row(result, 'pce-ok').note, /path filters/);
});

test('real prod commit with Android: its jobs gate, the experimental legs and lint do not', () => {
  const result = classifyChecks(android());
  assert.deepEqual(result.blocks, []);
  assert.deepEqual(names(result.warns), ['agents-ok', 'llamacpp-ok', 'lme-ok', 'local-models-ok', 'lre-compat-ok', 'lre-image-ok', 'lre-ok', 'pce-ok', 'proot-ok', 'web-ok']);
  assert.equal(row(result, 'Emulator smoke (lite, API 36)').role, 'blocking job');
  assert.equal(row(result, 'Release shape (lite + full, throwaway key)').role, 'blocking job');
  assert.equal(row(result, 'Debug APK (play)').role, 'blocking job');
  assert.equal(row(result, 'Emulator smoke (full, API 36)').role, 'experimental');
  assert.equal(row(result, 'Emulator smoke (lite, API 29)').role, 'experimental');
  assert.equal(row(result, 'Android lint').role, 'report-only');
  assert.equal(row(result, 'drift (opencode)').role, 'report-only');
  assert.equal(row(result, 'build (opencode)').role, 'other');
});

test('ci-ok failed: blocks', () => {
  const result = classifyChecks(patch(web(), 'ci-ok', red));
  assert.deepEqual(names(result.blocks), ['ci-ok']);
  assert.equal(result.rows[0].name, 'ci-ok', 'blocking rows sort first');
});

test('lint-ok still running: blocks until it finishes', () => {
  const result = classifyChecks(patch(web(), 'lint-ok', { status: 'in_progress', conclusion: null }));
  assert.deepEqual(names(result.blocks), ['lint-ok']);
  assert.equal(row(result, 'lint-ok').state, 'in_progress');
});

test('gate not started yet while its workflow runs: blocks as running', () => {
  const fx = web();
  fx.checkRuns = fx.checkRuns.filter((c) => c.name !== 'lint-ok');
  fx.workflowRuns.find((r) => r.name === 'Lint').status = 'in_progress';
  const result = classifyChecks(fx);
  assert.deepEqual(names(result.blocks), ['lint-ok']);
  assert.equal(row(result, 'lint-ok').state, 'running');
});

test('no CI at all: both required gates block', () => {
  const result = classifyChecks({ checkRuns: [], workflowRuns: [], statuses: [] });
  assert.deepEqual(names(result.blocks), ['ci-ok', 'lint-ok']);
  assert.match(row(result, 'ci-ok').note, /CI has not run/);
});

test('a run that finished without its gate blocks', () => {
  const fx = web();
  fx.checkRuns = fx.checkRuns.filter((c) => c.name !== 'tce-ok');
  const result = classifyChecks(fx);
  assert.deepEqual(names(result.blocks), ['tce-ok']);
  assert.equal(row(result, 'tce-ok').state, 'missing');
});

test('cancelled or skipped gates block; a skipped blocking job only warns', () => {
  assert.deepEqual(names(classifyChecks(patch(web(), 'web-ok', { conclusion: 'cancelled' })).blocks), ['web-ok']);
  assert.deepEqual(names(classifyChecks(patch(web(), 'ci-ok', { conclusion: 'skipped' })).blocks), ['ci-ok']);
  const skipped = classifyChecks(patch(android(), 'Debug APK (play)', { conclusion: 'skipped' }));
  assert.deepEqual(skipped.blocks, []);
  assert.equal(row(skipped, 'Debug APK (play)').decision, 'warn');
});

test('a payload drift leg red: warns, nothing blocks', () => {
  const result = classifyChecks(patch(android(), 'drift (opencode)', red));
  assert.deepEqual(result.blocks, []);
  assert.equal(row(result, 'drift (opencode)').decision, 'warn');
});

test('release-links red (and web-ok red only through it): warns, nothing blocks', () => {
  const fx = patch(patch(web(), 'Release downloads', red), 'web-ok', red);
  const result = classifyChecks(fx);
  assert.deepEqual(result.blocks, []);
  assert.equal(row(result, 'Release downloads').decision, 'warn');
  assert.equal(row(result, 'web-ok').decision, 'warn');
  assert.match(row(result, 'web-ok').note, /red only through Release downloads/);
});

test('release-links red but another web job red too: web-ok blocks', () => {
  const fx = patch(patch(patch(web(), 'Release downloads', red), 'Smoke (webkit)', red), 'web-ok', red);
  const result = classifyChecks(fx);
  assert.deepEqual(names(result.blocks), ['web-ok']);
  assert.equal(row(result, 'Smoke (webkit)').decision, 'warn', 'the gate speaks for the jobs it rolls up');
});

test('experimental emulator leg red: warns; the gating lite API 36 leg red: blocks', () => {
  const experimental = classifyChecks(patch(android(), 'Emulator smoke (full, API 36)', red));
  assert.deepEqual(experimental.blocks, []);
  assert.equal(row(experimental, 'Emulator smoke (full, API 36)').decision, 'warn');
  const gating = classifyChecks(patch(android(), 'Emulator smoke (lite, API 36)', red));
  assert.deepEqual(names(gating.blocks), ['Emulator smoke (lite, API 36)']);
});

test('Android assemble or release-shape red: blocks; Android lint red: warns', () => {
  assert.deepEqual(names(classifyChecks(patch(android(), 'Debug APK (full)', red)).blocks), ['Debug APK (full)']);
  const shape = 'Release shape (lite + full, throwaway key)';
  assert.deepEqual(names(classifyChecks(patch(android(), shape, red)).blocks), [shape]);
  const lint = classifyChecks(patch(android(), 'Android lint', red));
  assert.deepEqual(lint.blocks, []);
  assert.equal(row(lint, 'Android lint').decision, 'warn');
});

test('Android still running: blocks even before its later jobs have check runs', () => {
  const fx = android();
  fx.checkRuns = fx.checkRuns.filter((c) => !c.name.startsWith('Emulator smoke'));
  fx.workflowRuns.find((r) => r.name === 'Android').status = 'in_progress';
  const result = classifyChecks(fx);
  assert.deepEqual(names(result.blocks), ['(unfinished jobs)']);
});

test('a newer run of the same workflow on the commit supersedes the push run', () => {
  const fx = web();
  const push = fx.workflowRuns.find((r) => r.name === 'CI');
  const nightly = { ...push, id: push.id + 1000, event: 'schedule', check_suite_id: 1, created_at: '2026-11-08T02:17:00Z' };
  fx.workflowRuns.push(nightly);
  const pushGate = fx.checkRuns.find((c) => c.name === 'ci-ok');
  fx.checkRuns.push({ ...pushGate, id: pushGate.id + 1000, suite: 1, ...red });
  assert.deepEqual(names(classifyChecks(fx).blocks), ['ci-ok']);
  // Green nightly over a red push run: green.
  pushGate.conclusion = 'failure';
  fx.checkRuns.at(-1).conclusion = 'success';
  assert.deepEqual(classifyChecks(fx).blocks, []);
});

test('a re-run job keeps its newest attempt', () => {
  const fx = patch(web(), 'ci-ok', red);
  const first = fx.checkRuns.find((c) => c.name === 'ci-ok');
  fx.checkRuns.push({ ...first, id: first.id + 1, conclusion: 'success' });
  const result = classifyChecks(fx);
  assert.deepEqual(result.blocks, []);
  assert.equal(result.rows.filter((r) => r.name === 'ci-ok').length, 1);
});

test('commit statuses and other apps warn when not green, never block', () => {
  const fx = patch(web(), 'Workers Builds: phonecando', red);
  fx.statuses = [{ context: 'ci/external', state: 'failure' }, { context: 'ci/other', state: 'success' }];
  const result = classifyChecks(fx);
  assert.deepEqual(result.blocks, []);
  assert.equal(row(result, 'ci/external').decision, 'warn');
  assert.equal(row(result, 'ci/other').decision, 'ok');
  assert.equal(row(result, 'Workers Builds: phonecando').decision, 'warn');
});
