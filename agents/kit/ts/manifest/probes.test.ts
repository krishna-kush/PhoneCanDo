// probes.json (probes.ts) for a made-up image kind with an ACP mode, and the real opencode manifest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { MAX_PROBES, validateProbes } from './probes.ts';
import type { Manifest } from './types.ts';

const opencode: Manifest = JSON.parse(readFileSync(new URL('../../../native/opencode/agent.json', import.meta.url), 'utf8'));
const acpMode = { argv: ['/root/.local/bin/m', '--acp'] };
const image = { ...opencode, type: 'image', payload: undefined, engine: { ...opencode.engine, acp: acpMode } } as Manifest;
const noConfig = { ...image, config: undefined } as Manifest;
const noAcp = { ...image, engine: { ...image.engine, acp: undefined } } as Manifest;

const problems = (json: unknown, kind = image) => validateProbes(json, kind).problems.map((p) => `${p.path} ${p.code}`);
const HELP = { argv: ['/root/.local/bin/m', '--help'], has: ['--sandbox'] };

describe('probes', () => {
  it('takes help, run and acp probes', () => {
    assert.deepEqual(
      problems({
        help: [HELP, { argv: ['m', 'exec', '--help'], has: ['--json', '-c'], env: { NO_COLOR: '1' } }],
        run: [
          { argv: ['m', 'config', '--file={{config}}/m.toml'], env: { M_DIR: '{{home}}/.m', M_WORK: '{{projectDir}}' } },
          { argv: ['m', 'mcp', 'list'], has: ['phonecando'] },
        ],
        acp: { require: ['agentCapabilities.loadSession', 'agentCapabilities.sessionCapabilities.resume', 'protocolVersion'] },
      }),
      [],
    );
    assert.deepEqual(problems({ run: [{ argv: ['m', 'doctor'] }] }), []);
    assert.deepEqual(problems({ acp: { require: ['agentCapabilities.mcpCapabilities.http'] } }), []);
  });

  it('needs at least one part, and something in each', () => {
    assert.deepEqual(problems({}), [' required']);
    assert.deepEqual(problems({ help: [] }), ['/help length']);
    assert.deepEqual(problems({ acp: { require: [] } }), ['/acp/require length']);
    assert.deepEqual(problems({ help: [{ argv: ['m'] }] }), ['/help/0/has required']);
    assert.deepEqual(problems({ help: [{ argv: ['m'], has: ['x', ''] }] }), ['/help/0/has/1 length']);
    assert.deepEqual(problems({ run: [{ argv: [] }] }), ['/run/0/argv length']);
    assert.deepEqual(problems({ help: [HELP, HELP] }), ['/help unique']);
  });

  it('caps each list', () => {
    const many = Array.from({ length: MAX_PROBES + 1 }, (_, i) => ({ argv: ['m', `--x${i}`] }));
    assert.deepEqual(problems({ run: many }), ['/run length']);
    const paths = Array.from({ length: MAX_PROBES + 1 }, (_, i) => `p${i}`);
    assert.deepEqual(problems({ acp: { require: paths } }), ['/acp/require length']);
  });

  it('runs a guest program and fills only its own placeholders', () => {
    assert.deepEqual(problems({ help: [{ argv: ['{{home}}/.local/bin/m', '-h'], has: ['x'] }] }), ['/help/0/argv/0 pattern']);
    assert.deepEqual(problems({ run: [{ argv: ['m', '--dir={{tmp}}', '{{bridgeUrl}}'] }] }), ['/run/0/argv/1 unknown', '/run/0/argv/2 unknown']);
    assert.deepEqual(problems({ run: [{ argv: ['m', '{{config}}'] }] }, noConfig), ['/run/0/argv/1 unknown']);
    assert.deepEqual(problems({ run: [{ argv: ['m'], env: { A: '{{password}}' } }] }), ['/run/0/env/A unknown']);
  });

  it('leaves the host its env names', () => {
    assert.deepEqual(problems({ run: [{ argv: ['m'], env: { HOME: '/x', PHONECANDO_BRIDGE_URL: 'x', 'A B': '1' } }] }), [
      '/run/0/env/HOME reserved',
      '/run/0/env/PHONECANDO_BRIDGE_URL reserved',
      '/run/0/env/A B pattern',
    ]);
  });

  it('asks ACP of a kind with an ACP mode only, by dotted paths', () => {
    assert.deepEqual(problems({ acp: { require: ['agentCapabilities.loadSession'] } }, noAcp), ['/acp forbidden']);
    assert.deepEqual(problems({ acp: { require: ['a..b', '.a', 'a b', ''] } }), [
      '/acp/require/0 pattern',
      '/acp/require/1 pattern',
      '/acp/require/2 pattern',
      '/acp/require/3 pattern',
    ]);
    assert.deepEqual(problems({ acp: { require: ['x'], timeoutSec: 5 } }), ['/acp/timeoutSec unknown']);
  });

  it('is for image kinds only', () => {
    assert.deepEqual(problems({ help: [HELP] }, opencode), [' forbidden']);
  });

  it('refuses unknown fields and wrong types', () => {
    assert.deepEqual(problems({ help: [HELP], extra: 1 }), ['/extra unknown']);
    assert.deepEqual(problems({ run: [{ argv: ['m'], expect: 0 }] }), ['/run/0/expect unknown']);
    assert.deepEqual(problems([]), [' type']);
    assert.deepEqual(problems({ run: [{ argv: ['m'], env: { A: 1 } }] }), ['/run/0/env/A type']);
    assert.deepEqual(problems({ run: [{ argv: ['m', 2] }] }), ['/run/0/argv/1 type']);
  });
});
