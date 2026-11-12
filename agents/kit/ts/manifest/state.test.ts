// The instructions file and an agent's own state folder (state.ts), on the
// real opencode manifest (its instructions file is in config.into) and on a
// made-up image kind (its is not).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { SHARED_HOME, SHARED_HOME_PARENTS } from './rules.ts';
import { sharedPlace } from './state.ts';
import type { Manifest, Origin } from './types.ts';
import { validate } from './validate.ts';

const OPENCODE = new URL('../../../native/opencode/agent.json', import.meta.url);
const opencode = (): Manifest => {
  const m: Manifest = JSON.parse(readFileSync(OPENCODE, 'utf8'));
  delete m.state;
  return m;
};
const image = (): Manifest => ({
  schema: 1,
  id: 'demo',
  label: 'Demo',
  version: '1',
  type: 'image',
  channels: ['full'],
  stability: 'preview',
  licence: { spdx: null, redistributed: false, source: 'https://example.com' },
  requires: { linux: 'required' },
  instructions: '.demo/AGENTS.md',
  engine: { style: 'tui', launch: { argv: ['demo'] } },
  phoneTools: 'none',
});

function problems(base: () => Manifest, change: (m: Manifest) => void, origin: Origin = 'bundled'): string[] {
  const m = base();
  change(m);
  return validate(m, { origin }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (base: () => Manifest, change: (m: Manifest) => void) => assert.deepEqual(problems(base, change), []);
const fails = (base: () => Manifest, change: (m: Manifest) => void, ...want: string[]) => {
  const got = problems(base, change);
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};

describe('instructions', () => {
  it('is a path in HOME', () => {
    ok(image, () => {});
    ok(image, (m) => delete m.instructions);
    fails(image, (m) => (m.instructions = '/root/.demo/AGENTS.md'), '/instructions pattern');
    fails(image, (m) => (m.instructions = '../AGENTS.md'), '/instructions pattern');
    fails(opencode, (m) => (m.config = { ...m.config, instructions: 'AGENTS.md' } as Manifest['config']), '/config/instructions unknown');
  });
});

describe('state', () => {
  it('moves the state, and the instructions file with it', () => {
    ok(image, (m) => (m.state = { env: { DEMO_HOME: '{{stateDir}}/demo', DEMO_FLAG: '1' }, instructions: 'demo/AGENTS.md' }));
    ok(image, (m) => {
      delete m.instructions;
      m.state = { env: { DEMO_HOME: '{{stateDir}}' } };
    });
  });

  it('moves config.into with the instructions file in it', () => {
    ok(opencode, (m) => {
      m.state = { env: { XDG_CONFIG_HOME: '{{stateDir}}/config' }, instructions: 'config/opencode/AGENTS.md', config: 'config/opencode' };
    });
    fails(opencode, (m) => (m.state = { env: { A: '{{stateDir}}' }, instructions: 'AGENTS.md' }), '/state/config required');
    fails(
      opencode,
      (m) => (m.state = { env: { A: '{{stateDir}}' }, instructions: 'AGENTS.md', config: 'config/opencode' }),
      '/state/instructions mismatch',
    );
  });

  it('wants env, naming {{stateDir}}', () => {
    fails(image, (m) => (m.state = { instructions: 'a.md' } as Manifest['state']), '/state/env required');
    fails(image, (m) => (m.state = { env: {}, instructions: 'a.md' }), '/state/env length');
    fails(image, (m) => (m.state = { env: { A: '1' }, instructions: 'a.md' }), '/state/env required');
    fails(image, (m) => (m.state = { env: { A: '{{home}}/x' }, instructions: 'a.md' }), '/state/env/A unknown');
    fails(image, (m) => (m.state = { env: { A: '{{stateDir}}', B: '{{password}}' }, instructions: 'a.md' }), '/state/env/B unknown');
    fails(image, (m) => (m.state = { env: { A: '{{stateDir}}/{{' }, instructions: 'a.md' }), '/state/env/A pattern');
  });

  it('never sets what the host owns, HOME above all', () => {
    for (const name of ['HOME', 'TMPDIR', 'PHONECANDO_X', 'LD_PRELOAD']) {
      fails(image, (m) => (m.state = { env: { A: '{{stateDir}}', [name]: '{{stateDir}}' }, instructions: 'a.md' }), `/state/env/${name} reserved`);
    }
    fails(image, (m) => (m.state = { env: { 'A-B': '{{stateDir}}' }, instructions: 'a.md' }), '/state/env/A-B pattern');
  });

  it('holds the instructions file exactly when the kind has one', () => {
    fails(image, (m) => (m.state = { env: { A: '{{stateDir}}' } }), '/state/instructions required');
    fails(
      image,
      (m) => {
        delete m.instructions;
        m.state = { env: { A: '{{stateDir}}' }, instructions: 'a.md' };
      },
      '/state/instructions forbidden',
    );
  });

  it('moves config.into only when there is one', () => {
    fails(image, (m) => (m.state = { env: { A: '{{stateDir}}' }, instructions: 'a.md', config: 'c' }), '/state/config forbidden');
  });

  it('takes relative paths and no unknown field', () => {
    fails(image, (m) => (m.state = { env: { A: '{{stateDir}}' }, instructions: '/a.md' }), '/state/instructions pattern');
    fails(
      image,
      (m) => (m.state = { env: { A: '{{stateDir}}' }, instructions: 'a.md', home: 'x' } as Manifest['state']),
      '/state/home unknown',
    );
    fails(image, (m) => (m.state = [] as unknown as Manifest['state']), '/state type');
  });

  it('keeps {{stateDir}} out of every other template', () => {
    fails(image, (m) => (m.engine!.launch.env = { A: '{{stateDir}}' }), '/engine/launch/env/A forbidden');
    fails(image, (m) => m.engine!.launch.argv.push('{{stateDir}}'), '/engine/launch/argv/1 forbidden');
    fails(image, (m) => (m.engine!.launch.cwd = '{{stateDir}}'), '/engine/launch/cwd forbidden');
  });

  it("keeps a user kind's PATH out of it", () => {
    const user = () => ({ ...image(), id: 'user.demo' });
    const got = problems(user, (m) => (m.state = { env: { A: '{{stateDir}}', PATH: '{{stateDir}}/bin' }, instructions: 'a.md' }), 'user');
    assert.ok(got.includes('/state/env/PATH reserved'), got.join(', '));
  });
});

describe('userState', () => {
  it('names plain paths in HOME, each once', () => {
    ok(image, (m) => (m.userState = ['.demo', '.demo.json', '.config/demo', '.local/share/demo', '.cache/demo']));
    fails(image, (m) => (m.userState = []), '/userState length');
    fails(image, (m) => (m.userState = ['.demo', '.demo']), '/userState unique');
    fails(image, (m) => (m.userState = ['/root/.demo', '../x']), '/userState/0 pattern', '/userState/1 pattern');
  });

  it('never takes what the machine shares', () => {
    for (const path of ['projects', '.phonecando/agents', '.ssh', '.local', '.local/bin', '.local/opt/node', '.local/share/uv', '.config', '.cache']) {
      fails(image, (m) => (m.userState = [path]), '/userState/0 forbidden');
    }
    assert.equal(sharedPlace('.local'), '.local/bin');
    assert.equal(sharedPlace('.config'), '.config/git');
    assert.equal(sharedPlace('.local/state'), '.local/state');
    assert.equal(sharedPlace('.config/demo'), null);
    assert.equal(sharedPlace('projectsx'), null);
  });

  it("keeps the same lists as kit-render's UserStatePaths", () => {
    const kt = new URL('../../kotlin/render/src/main/kotlin/com/phonecando/agents/kit/render/UserStatePaths.kt', import.meta.url);
    const projectDir = new URL('../../kotlin/api/src/main/kotlin/com/phonecando/agents/kit/ProjectDir.kt', import.meta.url);
    const name = /const val NAME = "([^"]+)"/.exec(readFileSync(projectDir, 'utf8'))?.[1];
    const source = readFileSync(kt, 'utf8');
    const listOf = (field: string) => {
      const body = new RegExp(`val ${field} = listOf\\(([^)]*)\\)`).exec(source)?.[1] ?? '';
      return body
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => (item === 'ProjectDir.NAME' ? name : JSON.parse(item)));
    };
    assert.deepEqual(listOf('SHARED'), SHARED_HOME);
    assert.deepEqual(listOf('SHARED_PARENTS'), SHARED_HOME_PARENTS);
  });
});
