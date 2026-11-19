// logic/probes.mjs on a launch as kit-cli render-launch prints one.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fill, label, lacking, launchCommand, plain, probeCommand, probeValues, TOKEN_STAND_IN, verdict } from './probes.mjs';

const SCRIPT = "cd '/root/projects' || exit; PATH='/root/.local/opt/node/bin':$PATH; export PATH; exec \"$0\" \"$@\"";
const launch = {
  kind: 'k',
  mode: 'terminal',
  argv: ['/bin/sh', '-c', SCRIPT, '/root/.local/bin/k', '--tui'],
  env: { HOME: '/root', K_SETTINGS: '/root/.phonecando/k/settings.json', PHONECANDO_BRIDGE_URL: 'http://127.0.0.1:9' },
  token: 'PHONECANDO_BRIDGE_TOKEN',
  configDir: '/root/.phonecando/k',
  kitBin: '/root/.phonecando/bin',
};

describe('probe commands', () => {
  it('fills the probe placeholders from the launch', () => {
    assert.deepEqual(probeValues(launch), { home: '/root', projectDir: '/root/projects', config: '/root/.phonecando/k' });
    assert.deepEqual(probeValues({ ...launch, configDir: null }), { home: '/root', projectDir: '/root/projects' });
    assert.equal(fill('{{config}}/a:{{home}}', probeValues(launch)), '/root/.phonecando/k/a:/root');
    assert.throws(() => fill('{{tmp}}', probeValues(launch)), /\{\{tmp\}\} has no value/);
  });

  it('runs the probe through the launch sh, with the launch env, the token stand-in and its own env on top', () => {
    const probe = { argv: ['/root/.local/bin/k', 'mcp', 'list', '--file={{config}}/mcp.json'], env: { K_SETTINGS: '{{home}}/other.json' } };
    const command = probeCommand(launch, probe, probeValues(launch));
    assert.deepEqual(command.argv, ['/bin/sh', '-c', SCRIPT, '/root/.local/bin/k', 'mcp', 'list', '--file=/root/.phonecando/k/mcp.json']);
    assert.deepEqual(command.env, {
      HOME: '/root',
      K_SETTINGS: '/root/other.json',
      PHONECANDO_BRIDGE_URL: 'http://127.0.0.1:9',
      PHONECANDO_BRIDGE_TOKEN: TOKEN_STAND_IN,
    });
  });

  it('runs the ACP launch as it is, with no token when the bridge is not in its env', () => {
    const acp = { ...launch, mode: 'acp', token: null, env: { HOME: '/root' } };
    assert.deepEqual(launchCommand(acp), { argv: acp.argv, env: { HOME: '/root' } });
  });

  it('labels a probe by its program name and args', () => {
    assert.equal(label({ argv: ['/root/.local/bin/k', '--help'] }), 'k --help');
    assert.equal(label({ argv: ['k', 'x'.repeat(100)] }).length, 80);
  });
});

describe('verdicts', () => {
  const help = { argv: ['k', '--help'], has: ['--sandbox', '--resume'] };
  const ok = (output, code = 0) => ({ code, timedOut: false, output });

  it('reads help by its strings alone, colours and CRLF aside', () => {
    assert.equal(verdict('help', help, ok('\x1b[1m--sandbox\x1b[0m <mode>\r\n  --resume', 1)), null);
    assert.equal(verdict('help', help, ok('--sandbox only')), 'missing "--resume"');
    assert.equal(verdict('help', help, { code: null, timedOut: true, output: '' }), 'timed out');
  });

  it('wants a run to exit 0 with its strings', () => {
    const run = { argv: ['k', 'mcp', 'list'], has: ['phonecando'] };
    assert.equal(verdict('run', run, ok('phonecando: http')), null);
    assert.equal(verdict('run', run, ok('phonecando: http', 2)), 'exit 2');
    assert.equal(verdict('run', run, ok('nothing')), 'missing "phonecando"');
    assert.equal(verdict('run', { argv: ['k'] }, ok('')), null);
    assert.equal(verdict('run', { argv: ['k'] }, { code: null, timedOut: false, output: '' }), 'exit by signal');
  });

  it('strips OSC links and titles', () => {
    assert.equal(plain('\x1b]8;;https://x\x07--json\x1b]8;;\x07 \x1b]0;title\x1b\\ok'), '--json ok');
    assert.deepEqual(lacking('a b', ['a', 'c']), ['c']);
  });
});
