// exec.mjs and machine.mjs's docker argv; a probe run through a launch's sh
// on this host, as a leg runs one in its machine.
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { probeCommand, verdict } from '../logic/probes.mjs';
import { capture } from './exec.mjs';
import { execArgv } from './machine.mjs';

const node = (code) => [process.execPath, '-e', code];

describe('capture', () => {
  it('keeps stdout and stderr in one buffer, with the exit code', async () => {
    const r = await capture(node('process.stdout.write("out "); process.stderr.write("err"); process.exit(4)'));
    assert.equal(r.code, 4);
    assert.match(r.output, /out/);
    assert.match(r.output, /err/);
    assert.equal(r.timedOut, false);
  });

  it('kills what runs too long', async () => {
    const r = await capture(node('setTimeout(() => {}, 60000)'), { timeoutMs: 300 });
    assert.equal(r.timedOut, true);
  });

  it('reads a program that cannot start as exit 127', async () => {
    const r = await capture(['/nonexistent/program']);
    assert.equal(r.code, 127);
    assert.match(r.output, /ENOENT/);
  });
});

describe('a probe through the launch sh', () => {
  // A launch whose sh only execs, as render-launch's does after its cd and PATH.
  const launch = { argv: ['/bin/sh', '-c', 'exec "$0" "$@"', 'k'], env: { ...process.env, K_MODE: 'probe' }, token: null, configDir: null };
  const values = { home: '/root', projectDir: '/root/projects' };

  it('passes help on its strings and run on exit 0', async () => {
    const help = { argv: [process.execPath, '-e', 'console.error("--sandbox <mode> " + process.env.K_MODE); process.exit(1)'], has: ['--sandbox', 'probe'] };
    assert.equal(verdict('help', help, await capture(probeCommand(launch, help, values).argv, { env: launch.env })), null);
    const run = { argv: [process.execPath, '-e', 'process.exit(process.argv[1] === "/root/projects" ? 0 : 5)', '{{projectDir}}'] };
    assert.equal(verdict('run', run, await capture(probeCommand(launch, run, values).argv, { env: launch.env })), null);
    const failing = { argv: [process.execPath, '-e', 'process.exit(5)'] };
    assert.equal(verdict('run', failing, await capture(probeCommand(launch, failing, values).argv, { env: launch.env })), 'exit 5');
  });
});

describe('execArgv', () => {
  it('passes env by name, never its values, and ends the command after its time', () => {
    const argv = execArgv('c1', { argv: ['/bin/sh', '-c', 'x'], env: { A: 'secret value', B: '2' }, cwd: '/root', timeoutSec: 30 });
    assert.deepEqual(argv, ['docker', 'exec', '-w', '/root', '-e', 'A', '-e', 'B', 'c1', 'timeout', '-k', '5', '30', '/bin/sh', '-c', 'x']);
    assert.ok(!argv.includes('secret value'));
    assert.equal(execArgv('c1', { argv: ['a'], timeoutSec: 1, interactive: true })[2], '-i');
  });
});
