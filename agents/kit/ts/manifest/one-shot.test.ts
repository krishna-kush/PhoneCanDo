// one-shot.json (one-shot.ts) for the real opencode manifest and a made-up image kind.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { validateOneShot } from './one-shot.ts';
import type { Manifest } from './types.ts';

const opencode: Manifest = JSON.parse(readFileSync(new URL('../../../native/opencode/agent.json', import.meta.url), 'utf8'));
const image = { ...opencode, type: 'image', payload: undefined } as Manifest;

const problems = (json: unknown, kind = image) => validateOneShot(json, kind).problems.map((p) => `${p.path} ${p.code}`);

describe('one-shot', () => {
  it('takes a program, its args with one {{prompt}} item, and env', () => {
    assert.deepEqual(problems({ argv: ['/root/.local/bin/m', '-p', '{{prompt}}', '--dir={{projectDir}}'], env: { M_QUIET: '1' } }), []);
    assert.deepEqual(problems({ argv: ['{{libDir}}/liboc-engine.so', 'run', '{{prompt}}'] }, opencode), []);
  });

  it('needs exactly one whole {{prompt}} item after the program', () => {
    assert.deepEqual(problems({ argv: ['m', 'run'] }), ['/argv pattern']);
    assert.deepEqual(problems({ argv: ['m', '{{prompt}}', '{{prompt}}'] }), ['/argv pattern']);
    assert.ok(problems({ argv: ['{{prompt}}', 'm'] }).includes('/argv pattern'));
    assert.deepEqual(problems({ argv: ['m', '--message={{prompt}}'] }), ['/argv/1 unknown', '/argv pattern']);
    assert.deepEqual(problems({ argv: ['m'] }), ['/argv length', '/argv pattern']);
  });

  it('runs the program the kind runs', () => {
    assert.deepEqual(problems({ argv: ['{{home}}/bin/m', '{{prompt}}'] }), ['/argv/0 pattern']);
    assert.deepEqual(problems({ argv: ['{{libDir}}/libother.so', '{{prompt}}'] }, opencode), ['/argv/0 pattern']);
    assert.deepEqual(problems({ argv: ['{{libDir}}/liboc-engine.so', '{{prompt}}'] }), ['/argv/0 unknown', '/argv/0 pattern']);
  });

  it('keeps engine and model placeholders and host env names out', () => {
    assert.deepEqual(problems({ argv: ['m', '{{prompt}}', '--port={{port}}'] }), ['/argv/2 unknown']);
    assert.deepEqual(problems({ argv: ['m', '{{prompt}}'], env: { K: '{{password}}', M: '{{model}}' } }), ['/env/K unknown', '/env/M unknown']);
    assert.deepEqual(problems({ argv: ['m', '{{prompt}}'], env: { HOME: '/x', PHONECANDO_X: '1' } }), ['/env/HOME reserved', '/env/PHONECANDO_X reserved']);
  });

  it('refuses unknown fields and wrong types', () => {
    assert.deepEqual(problems({ argv: ['m', '{{prompt}}'], timeoutSec: 5 }), ['/timeoutSec unknown']);
    assert.deepEqual(problems({ env: {} }), ['/argv required']);
    assert.deepEqual(problems([]), [' type']);
    assert.deepEqual(problems({ argv: ['m', '{{prompt}}'], env: { A: 1 } }), ['/env/A type']);
  });
});
