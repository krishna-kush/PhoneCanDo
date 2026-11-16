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
