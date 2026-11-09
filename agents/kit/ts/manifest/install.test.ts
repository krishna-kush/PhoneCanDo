// The install blocks (install.ts) and hook events (events.ts), one rule at a
// time on the gemini-cli fixture; the fixtures cover the main cases.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parseRuntimeNeed } from './install.ts';
import type { Manifest } from './types.ts';
import { validate } from './validate.ts';

const FIXTURE = new URL('../../schema/fixtures/valid/gemini-cli.json', import.meta.url);
const gemini = (): Manifest => JSON.parse(readFileSync(FIXTURE, 'utf8'));

function problems(change: (m: Manifest) => void): string[] {
  const m = gemini();
  change(m);
  return validate(m, { origin: 'bundled' }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (change: (m: Manifest) => void) => assert.deepEqual(problems(change), []);
const fails = (change: (m: Manifest) => void, ...want: string[]) => {
  const got = problems(change);
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};

describe('requires.runtimes', () => {
  it('names a runtime, optionally at least a major version', () => {
    assert.deepEqual(parseRuntimeNeed('node'), { id: 'node', atLeast: null });
    assert.deepEqual(parseRuntimeNeed('node>=22'), { id: 'node', atLeast: 22 });
    for (const bad of ['node>=0', 'node>22', 'node>=22.1', 'Node', 'node>=']) assert.equal(parseRuntimeNeed(bad), null, bad);
    ok((m) => (m.requires!.runtimes = ['node', 'python>=3']));
    fails((m) => (m.requires!.runtimes = ['node>=22', 'node']), '/requires/runtimes/1 unique');
  });
});

describe('install', () => {
  it('may name nothing but its version check', () => {
    ok((m) => {
      m.install = {};
      delete m.requires!.runtimes;
    });
  });

  it('runs steps with {{home}} and the shell’s own ${…}', () => {
    ok((m) => (m.install!.steps = ['mkdir -p "{{home}}/x" "${HOME}/y"', 'echo {a}']));
    fails((m) => (m.install!.steps = ['echo {{tmp}}']), '/install/steps/0 unknown');
    fails((m) => (m.update!.steps = ['echo {{password}}']), '/update/steps/0 unknown');
    fails((m) => (m.install!.steps = ['echo {{home']), '/install/steps/0 pattern');
  });

  it('keys packages by family, * the fallback', () => {
    ok((m) => (m.install!.packages = { '*': ['git'] }));
    ok((m) => {
      delete m.install!.families;
      m.install!.packages = { xbps: ['git'], microdnf: ['git'] };
    });
    fails((m) => (m.install!.packages = { yum: ['git'] }), '/install/packages/yum mismatch');
    fails((m) => (m.install!.packages = { apt: [] }), '/install/packages/apt length');
    fails((m) => (m.install!.packages = { apt: ['$(id)'] }), '/install/packages/apt/0 pattern');
    fails((m) => (m.install!.families = []), '/install/families length');
  });

  it('bounds its timeout', () => {
    fails((m) => (m.install!.timeoutSec = 0), '/install/timeoutSec range');
    fails((m) => (m.install!.timeoutSec = 7201), '/install/timeoutSec range');
    fails((m) => (m.install!.timeoutSec = 1.5), '/install/timeoutSec type');
  });

  it('bounds its retries, 0 to 5', () => {
    ok((m) => (m.install!.retries = 0));
    ok((m) => (m.install!.retries = 5));
    ok((m) => delete m.install!.retries);
    fails((m) => (m.install!.retries = -1), '/install/retries range');
    fails((m) => (m.install!.retries = 6), '/install/retries range');
    fails((m) => (m.install!.retries = 1.5), '/install/retries type');
    fails((m) => (m.install!.retries = '2' as never), '/install/retries type');
    fails((m) => (m.update = { steps: ['true'], retries: 1 } as never), '/update/retries unknown');
  });

  it('is for image kinds only', () => {
    const codex = JSON.parse(readFileSync(new URL('../../schema/fixtures/valid/codex.json', import.meta.url), 'utf8'));
    const { install, update, versionCheck } = gemini();
    const got = validate({ ...codex, install, update, versionCheck }, { origin: 'bundled' }).problems.map((p) => `${p.path} ${p.code}`);
    for (const key of ['install', 'update', 'versionCheck']) assert.ok(got.includes(`/${key} forbidden`), got.join(', '));
  });

  it('is open to a user-added kind', () => {
    const top = JSON.parse(readFileSync(new URL('../../schema/fixtures/valid/user-top.json', import.meta.url), 'utf8'));
    const { install, versionCheck } = gemini();
    assert.deepEqual(validate({ ...top, install, versionCheck }, { origin: 'user' }).problems, []);
  });
});

describe('versionCheck', () => {
  it('runs a guest command or a guest path, {{home}} included', () => {
    ok((m) => (m.versionCheck!.argv = ['gemini', '--version']));
    ok((m) => (m.versionCheck!.argv = ['/usr/bin/gemini']));
    fails((m) => (m.versionCheck!.argv = ['{{libDir}}/x']), '/versionCheck/argv/0 unknown');
    fails((m) => (m.versionCheck!.argv = []), '/versionCheck/argv length');
    fails((m) => (m.versionCheck!.pattern = '(\\d+'), '/versionCheck/pattern pattern');
  });
});

describe('hook events', () => {
  it('map names to engine events on a tui engine', () => {
    ok((m) => (m.events = [{ hook: { map: { 'session:end': 'finished', Stop: 'finished' } } }, { pty: { rules: [{ on: 'bel', event: 'waiting' }] } }]));
    fails((m) => (m.events = [{ hook: { map: {} } }]), '/events/0/hook/map length');
    fails((m) => (m.events = [{ hook: {} } as never]), '/events/0/hook/map required');
    fails((m) => (m.events = [{ hook: { map: { Stop: 'finished' } }, pty: { rules: [] } } as never]), '/events/0/hook forbidden');
  });
});
