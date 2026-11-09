// What a kind needs (requires) and the rules per type and origin (kinds.ts),
// on the user.top fixture: the user-added kind the device proof runs.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Manifest, Origin } from './types.ts';
import { validate } from './validate.ts';

const FIXTURES = new URL('../../schema/fixtures/valid/', import.meta.url);
type Loose = Manifest & Record<string, unknown>;
const read = (file: string): Loose => JSON.parse(readFileSync(new URL(file, FIXTURES), 'utf8'));

function problems(file: string, origin: Origin, change: (m: Loose) => void): string[] {
  const m = read(file);
  change(m);
  return validate(m, { origin }).problems.map((p) => `${p.path} ${p.code}`);
}

const fails = (got: string[], ...want: string[]) => {
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};
const top = (change: (m: Loose) => void) => problems('user-top.json', 'user', change);

describe('requires', () => {
  it('is typed', () => {
    fails(top((m) => (m.requires = { linux: 'maybe' as never })), '/requires/linux enum');
    fails(top((m) => (m.requires!.commands = ['top', 'top'])), '/requires/commands unique');
    fails(top((m) => (m.requires!.commands = ['rm -rf'])), '/requires/commands/0 pattern');
    fails(top((m) => (m.requires!.runtimes = ['Node22'])), '/requires/runtimes/0 pattern');
    fails(top((m) => (m.requires = { gpu: true } as never)), '/requires/gpu unknown');
  });

  it('says Linux is required for an image kind, anything for a native one', () => {
    fails(top((m) => delete m.requires), '/requires required');
    fails(top((m) => (m.requires = {})), '/requires/linux required');
    fails(top((m) => (m.requires!.linux = 'none')), '/requires/linux const');
    assert.deepEqual(problems('codex.json', 'bundled', (m) => (m.requires = { linux: 'optional' })), []);
  });
});

describe('image kinds', () => {
  it('run a guest command or an absolute guest path', () => {
    assert.deepEqual(top((m) => (m.engine!.launch.argv = ['/usr/bin/top', '-d', '1'])), []);
    fails(top((m) => (m.engine!.launch.argv = ['bin/top'])), '/engine/launch/argv/0 pattern');
    fails(top((m) => (m.engine!.launch.argv = ['{{home}}/top'])), '/engine/launch/argv/0 pattern');
    fails(top((m) => (m.engine!.launch.argv = ['my top'])), '/engine/launch/argv/0 pattern');
  });
});

describe('licence', () => {
  it('may leave the SPDX id unknown only when we do not redistribute', () => {
    assert.deepEqual(top((m) => (m.licence.spdx = null)), []);
    fails(top((m) => (m.licence.redistributed = true)), '/licence/spdx type');
    fails(top((m) => (m.licence.spdx = 7 as never)), '/licence/spdx type');
  });
});

describe('user-added kinds', () => {
  it('run their own TUI', () => {
    fails(top((m) => delete m.engine), '/engine required');
    fails(top((m) => (m.engine!.style = 'server')), '/engine/style forbidden');
  });

  it('use a user. id, never a bundled one', () => {
    fails(top((m) => (m.id = 'top')), '/id pattern');
    fails(problems('user-top.json', 'bundled', () => {}), '/id reserved');
  });
});
