// config/launch.sh run as the runner runs it (`sh launch.sh [args]`), with
// a fake `cline` on PATH that records how it was started and answers
// `cline history --json` with rows we choose: the plugin copy, the hub's
// discovery file per Cline folder, --phonecando-continue and --acp.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('../config/launch.sh', import.meta.url));
const PLUGIN = readFileSync(new URL('../config/phonecando.js', import.meta.url), 'utf8');

const made = [];
after(() => made.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

// A fake cline: `history` prints $FAKE_ROWS (or fails with FAKE_FAIL),
// anything else writes its argv and a few env values to $FAKE_OUT.
const FAKE = `#!/bin/sh
if [ "$1" = history ]; then
  [ -n "\${FAKE_FAIL:-}" ] && exit 1
  printf '%s' "\${FAKE_ROWS:-[]}"
  exit 0
fi
node -e 'require("fs").writeFileSync(process.env.FAKE_OUT, JSON.stringify({ argv: process.argv.slice(1), cwd: process.cwd(), hub: process.env.CLINE_HUB_DISCOVERY_PATH, provider: process.env.CLINE_PROVIDER ?? null }))' -- "$@"
`;

function run(args = [], { env = {}, rows, fail = false } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'cline-launch-'));
  made.push(base);
  const home = join(base, 'home');
  const work = join(base, 'projects');
  const bin = join(base, 'bin');
  mkdirSync(home);
  mkdirSync(work);
  mkdirSync(bin);
  writeFileSync(join(bin, 'cline'), FAKE);
  chmodSync(join(bin, 'cline'), 0o755);
  const out = join(base, 'out.json');
  return {
    home,
    work,
    go(more = {}) {
      const r = spawnSync('sh', [SCRIPT, ...args], {
        cwd: work,
        encoding: 'utf8',
        env: {
          PATH: `${bin}:${dirname(process.execPath)}:/usr/bin:/bin`,
          HOME: home,
          FAKE_OUT: out,
          FAKE_ROWS: rows === undefined ? '' : JSON.stringify(rows),
          ...(fail ? { FAKE_FAIL: '1' } : {}),
          ...env,
          ...more,
        },
      });
      assert.equal(r.status, 0, r.stderr);
      return JSON.parse(readFileSync(out, 'utf8'));
    },
  };
}

const row = (sessionId, cwd, updatedAt, extra = {}) => ({ sessionId, cwd, workspaceRoot: cwd, updatedAt, startedAt: updatedAt, isSubagent: false, ...extra });

test('a plain start runs cline with nothing added', () => {
  const t = run();
  const got = t.go();
  assert.deepEqual(got.argv, []);
  assert.equal(got.cwd, t.work);
});

test('the hub discovery file is in the agent\'s own Cline folder', () => {
  const t = run();
  assert.equal(t.go().hub, join(t.home, '.cline/data/locks/hub/phonecando.json'));
  const own = join(t.home, '.phonecando/agents/a2/cline');
  assert.equal(t.go({ CLINE_DIR: own }).hub, join(own, 'data/locks/hub/phonecando.json'));
});

test('--phonecando-continue opens the newest chat of this folder', () => {
  const t = run(['--phonecando-continue']);
  const rows = [
    row('1_old_cli', null, '2026-11-18T10:00:00.000Z'),
    row('2_other_cli', '/elsewhere', '2026-11-19T12:00:00.000Z'),
    row('3_sub_cli', null, '2026-11-19T11:00:00.000Z', { isSubagent: true }),
    row('4_new_cli', null, '2026-11-19T09:00:00.000Z'),
  ];
  // The folder is only known once made; fill it in.
  for (const r of rows) if (r.cwd === null) r.cwd = r.workspaceRoot = t.work;
  assert.deepEqual(t.go({ FAKE_ROWS: JSON.stringify(rows) }).argv, ['--id', '4_new_cli']);
});

test('--phonecando-continue with no chat here, no history, or a broken one starts fresh', () => {
  assert.deepEqual(run(['--phonecando-continue'], { rows: [row('1_x_cli', '/elsewhere', '2026-11-19T09:00:00Z')] }).go().argv, []);
  assert.deepEqual(run(['--phonecando-continue'], { rows: [] }).go().argv, []);
  assert.deepEqual(run(['--phonecando-continue'], { fail: true }).go().argv, []);
  assert.deepEqual(run(['--phonecando-continue']).go({ FAKE_ROWS: 'not json' }).argv, []);
  // An id that isn't a plain one is never passed on.
  const t = run(['--phonecando-continue']);
  assert.deepEqual(t.go({ FAKE_ROWS: JSON.stringify([row('1; rm -rf x', t.work, '2026-11-19T09:00:00Z')]) }).argv, []);
});

test('a prompt with --phonecando-continue reopens the chat and hands the prompt to the plugin', () => {
  const t = run(['--phonecando-continue', '--tui', '--', 'go on: "the tests"']);
  const before = Date.now();
  const got = t.go({ FAKE_ROWS: JSON.stringify([row('4_new_cli', t.work, '2026-11-19T09:00:00Z')]) });
  // --id takes no prompt, so it never reaches cline's argv.
  assert.deepEqual(got.argv, ['--id', '4_new_cli', '--tui']);
  const handed = JSON.parse(readFileSync(join(t.home, '.cline', 'phonecando-prompt.json'), 'utf8'));
  assert.equal(handed.prompt, 'go on: "the tests"');
  assert.ok(handed.at >= before && handed.at <= Date.now());
});

test('a prompt with no chat to go back to starts a new chat with it, as before', () => {
  const t = run(['--phonecando-continue', '--tui', '--', 'fix the tests']);
  assert.deepEqual(t.go({ FAKE_ROWS: '[]' }).argv, ['--tui', '--', 'fix the tests']);
  assert.equal(existsSync(join(t.home, '.cline', 'phonecando-prompt.json')), false);
});

test('ACP mode and a chat\'s args pass through', () => {
  assert.deepEqual(run(['--tui', '--id', '7_x_cli']).go().argv, ['--tui', '--id', '7_x_cli']);
  const t = run(['--acp']);
  const got = t.go();
  assert.deepEqual(got.argv, ['--acp']);
  assert.equal(got.provider, null);
});

test('--acp takes the provider the TUI last used, from the agent\'s own folder', () => {
  const t = run(['--acp']);
  const own = join(t.home, 'own');
  mkdirSync(join(own, 'data/settings'), { recursive: true });
  writeFileSync(join(own, 'data/settings/providers.json'), JSON.stringify({ lastUsedProvider: 'openrouter' }));
  assert.equal(t.go({ CLINE_DIR: own }).provider, 'openrouter');
  assert.equal(t.go({ CLINE_DIR: own, CLINE_PROVIDER: 'cline' }).provider, 'cline');
  writeFileSync(join(own, 'data/settings/providers.json'), JSON.stringify({ lastUsedProvider: 'a b; c' }));
  assert.equal(t.go({ CLINE_DIR: own }).provider, null);
});

test('the plugin is copied in when missing, kept current while ours, and never over yours', () => {
  const t = run();
  const dst = join(t.home, '.cline/plugins/phonecando.js');
  t.go();
  assert.equal(readFileSync(dst, 'utf8'), PLUGIN);
  assert.equal(lstatSync(dst).isSymbolicLink(), false);

  // An older copy of ours is replaced.
  writeFileSync(dst, `${PLUGIN.split('\n')[0]}\nold\n`);
  t.go();
  assert.equal(readFileSync(dst, 'utf8'), PLUGIN);

  // Yours (no mark) stays as it is.
  writeFileSync(dst, 'export default { name: "mine", manifest: { capabilities: ["hooks"] } };\n');
  t.go();
  assert.match(readFileSync(dst, 'utf8'), /mine/);

  // A link of yours too.
  rmSync(dst);
  const target = join(t.home, 'elsewhere.js');
  writeFileSync(target, 'x\n');
  symlinkSync(target, dst);
  t.go();
  assert.ok(lstatSync(dst).isSymbolicLink());
  assert.equal(readFileSync(target, 'utf8'), 'x\n');

  // A second agent's own folder gets its own copy.
  const own = join(t.home, '.phonecando/agents/a2/cline');
  t.go({ CLINE_DIR: own });
  assert.equal(readFileSync(join(own, 'plugins/phonecando.js'), 'utf8'), PLUGIN);
  assert.equal(existsSync(join(own, 'plugins')), true);
});
