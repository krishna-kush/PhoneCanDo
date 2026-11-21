// ./manage's dispatch with run.mjs's recorder set: exit codes, usage errors
// and the commands each line runs. Nothing is executed.
import assert from 'node:assert/strict';
import { relative } from 'node:path';
import { test } from 'node:test';
import { splitAgentFlags } from './before-build.mjs';
import { COMMANDS, main } from './main.mjs';
import { ROOT } from './paths.mjs';
import { setRecord } from './run.mjs';
import { GROUPS, render } from './usage.mjs';
import { appVersion } from './version.mjs';

// Each line's recorded commands, repo-relative; stdout and stderr muted.
function dispatch(argv) {
  const calls = [];
  setRecord((cmd, cwd) => calls.push([relative(ROOT, cwd) || '.', ...cmd.map((a) => (a.startsWith(ROOT) ? relative(ROOT, a) : a))]));
  const { log, error } = console;
  console.log = console.error = () => {};
  try {
    return { code: main(argv), calls };
  } finally {
    Object.assign(console, { log, error });
    setRecord(null);
  }
}

test('help: no command, help, -h and --help print it and exit 0', () => {
  for (const argv of [[], ['help'], ['-h'], ['--help']]) assert.equal(dispatch(argv).code, 0);
  assert.match(render(), /one entry point for the repo's scripts/);
});

test('every command is in the help, and the help names no other', () => {
  const documented = new Set(GROUPS.flatMap(([, commands]) => commands.map(([line]) => line.split(' ')[0])));
  assert.deepEqual([...documented].sort(), Object.keys(COMMANDS).sort());
});

test('bad command lines exit 2 and run nothing', () => {
  const bad = [
    ['no-such-command'],
    ['build'],
    ['build', 'play'],
    ['android', 'desktop'],
    ['web'],
    ['agent'],
    ['agent', 'opencode'],
    ['agent', 'nope', 'build'],
    ['agent', 'new', 'x'],
    ['agent', 'status', 'desktop'],
    ['agent', 'status', '--download', 'opencode'],
    ['build', 'full', '--rebuild'],
    ['release'],
    ['release', '--dry-run'],
    ['image', 'pull'],
    ['apk', 'info', '/nonexistent.apk'],
    ['device', 'push'],
    ['constructor'],
  ];
  for (const argv of bad) assert.deepEqual(dispatch(argv), { code: 2, calls: [] }, argv.join(' '));
});

test('agent flags come out of the build arguments, ids and all', () => {
  assert.deepEqual(splitAgentFlags(['--clean', '--rebuild', 'opencode', '--download', 'a,b']), [
    ['--rebuild', 'opencode', '--download', 'a,b'],
    ['--clean'],
  ]);
  assert.deepEqual(splitAgentFlags([]), [[], []]);
});

test('build runs the limits check, proot, the agents step, then the build script', () => {
  const { code, calls } = dispatch(['build', 'full', '--rebuild', 'opencode', '--clean']);
  assert.equal(code, 0);
  assert.deepEqual(calls.map((call) => call.slice(1, 3).join(' ')), [
    'node tce/scripts/check-limits.mjs',
    'node tce/scripts/data.mjs', // no terminal to ask: the report's default, yes
    'bash lre/proot/ensure.sh',
    'node agents/kit/native/ensure.mjs',
    'node scripts/build-android.mjs',
  ]);
  assert.deepEqual(calls[3].slice(3), ['full', '--rebuild', 'opencode']);
  assert.deepEqual(calls[4].slice(3), ['full', '--clean']);
});

test('a release dry run only checks proot and the agents, and asks the release script for a dry run', () => {
  const { calls } = dispatch(['release', '1.0.0', '--dry-run']);
  assert.deepEqual(calls[2].slice(1), ['bash', 'lre/proot/ensure.sh', '--check']);
  assert.deepEqual(calls[3].slice(1), ['node', 'agents/kit/native/ensure.mjs', 'full', 'lite', '--release', '--check']);
  assert.deepEqual(calls[4].slice(1), ['node', 'scripts/release-android.mjs', '--version', '1.0.0', '--dry-run']);
});

test('--without-linux skips proot; --upload-only skips proot and the agents', () => {
  const linuxless = dispatch(['release', '1.0.0', '--without-linux']).calls.map((call) => call[2]);
  assert.ok(!linuxless.includes('lre/proot/ensure.sh'));
  assert.ok(linuxless.includes('agents/kit/native/ensure.mjs'));
  const upload = dispatch(['release', '1.0.0', '--upload-only']).calls.map((call) => call[2]);
  assert.ok(!upload.includes('lre/proot/ensure.sh') && !upload.includes('agents/kit/native/ensure.mjs'));
});

test('agent status reports on full and lite unless channels are named', () => {
  assert.deepEqual(dispatch(['agent', 'status']).calls[0].slice(2), ['agents/kit/native/ensure.mjs', '--check', 'full', 'lite']);
  assert.deepEqual(dispatch(['agent', 'sync', 'lite', '--download', 'opencode']).calls[0].slice(2), [
    'agents/kit/native/ensure.mjs',
    'lite',
    '--download',
    'opencode',
  ]);
});

test('an image kind has nothing to build, stage or lock', () => {
  assert.equal(dispatch(['agent', 'claude-code', 'build']).code, 2);
  assert.equal(dispatch(['agent', 'claude-code', 'test']).code, 0);
});

test('release --via-github starts release.yml on prod with the inputs given', () => {
  const { code, calls } = dispatch(['release', '1.0.0', '--via-github', '--notes', 'Hello there', '--label', 'beta', '--allow-red-ci']);
  // Recording, no run ever shows up: it stops (1) after starting the workflow.
  assert.equal(code, 1);
  const start = calls.find((call) => call[1] === 'gh' && call[2] === 'workflow');
  assert.deepEqual(start.slice(1, 7), ['gh', 'workflow', 'run', 'release.yml', '-R', start[6]]);
  assert.deepEqual(start.slice(7), ['--ref', 'prod', '-f', 'version=1.0.0', '-f', 'notes=Hello there', '-f', 'label=beta', '-f', 'allow_red_ci=true']);
  // Nothing local: no limits check, proot, agents or release script.
  assert.ok(!calls.some((call) => call[1] === 'node' || call[1] === 'bash'));
});

test('release --via-github refuses the flags only a local release has', () => {
  for (const flag of ['--dry-run', '--upload-only', '--without-linux', '--clean']) {
    assert.deepEqual(dispatch(['release', '1.0.0', '--via-github', flag]), { code: 2, calls: [] }, flag);
  }
});

test('release --via-github takes --accept-all but needs no input for it: the workflow always passes it', () => {
  const { calls } = dispatch(['release', '1.0.0', '--via-github', '--accept-all']);
  const start = calls.find((call) => call[1] === 'gh' && call[2] === 'workflow');
  assert.deepEqual(start.slice(7), ['--ref', 'prod', '-f', 'version=1.0.0']);
});

test('release --major|--minor|--patch counts up from app/app.json, for both release paths', () => {
  const [major, minor, patch] = appVersion().split('.').map(Number);
  const local = (bump) => dispatch(['release', bump, '--dry-run']).calls.find((call) => call[2] === 'scripts/release-android.mjs');
  assert.deepEqual(local('--patch').slice(3), ['--version', `${major}.${minor}.${patch + 1}`, '--dry-run']);
  assert.deepEqual(local('--minor').slice(3), ['--version', `${major}.${minor + 1}.0`, '--dry-run']);
  assert.deepEqual(local('--major').slice(3), ['--version', `${major + 1}.0.0`, '--dry-run']);
  const start = dispatch(['release', '--via-github', '--minor']).calls.find((call) => call[2] === 'workflow');
  assert.ok(start.includes(`version=${major}.${minor + 1}.0`));
});

test('release takes a version or one bump, never both, and no bump with --upload-only', () => {
  for (const argv of [
    ['release'],
    ['release', '--dry-run'],
    ['release', '1.2.3', '--patch'],
    ['release', '--major', '--minor'],
    ['release', 'v1.2.3'],
    ['release', '--patch', '--upload-only'],
  ]) {
    assert.deepEqual(dispatch(argv), { code: 2, calls: [] }, argv.join(' '));
  }
});
