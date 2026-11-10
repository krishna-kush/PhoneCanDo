// The runtime blocks (runtime.ts) and templates (templates.ts), one rule at a
// time on the real opencode manifest; the fixtures cover the main cases.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Manifest } from './types.ts';
import { validate } from './validate.ts';

const MANIFEST = new URL('../../../native/opencode/agent.json', import.meta.url);
const opencode = (): Manifest => JSON.parse(readFileSync(MANIFEST, 'utf8'));

/** The problems of opencode's manifest after `change`, as "path code". */
function problems(change: (m: Manifest) => void): string[] {
  const m = opencode();
  change(m);
  return validate(m, { origin: 'bundled' }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (change: (m: Manifest) => void) => assert.deepEqual(problems(change), []);
const fails = (change: (m: Manifest) => void, ...want: string[]) => {
  const got = problems(change);
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};

describe('templates', () => {
  it('pass ${…} and lone braces through', () => {
    ok((m) => {
      m.engine!.launch.argv.push('${HOME}/x', '{a}', 'a}}b');
      m.engine!.launch.env!.EXTRA = '${PATH}:{{libDir}}';
    });
  });

  it('refuse an unknown placeholder, and a stray {{', () => {
    fails((m) => m.engine!.launch.argv.push('{{bridgeToken}}'), '/engine/launch/argv/6 unknown');
    fails((m) => m.engine!.launch.argv.push('{{{port}}}'), '/engine/launch/argv/6 pattern');
    fails((m) => m.engine!.launch.argv.push('{{port'), '/engine/launch/argv/6 pattern');
  });

  it('keep {{password}} to env values', () => {
    ok((m) => (m.surfaces!.terminal!.client!.env!.OTHER = 'x{{password}}'));
    fails((m) => (m.surfaces!.terminal!.client!.cwd = '{{password}}'), '/surfaces/terminal/client/cwd forbidden');
    fails((m) => (m.chats!.title.http.path = '/api/{{password}}'), '/chats/title/http/path forbidden');
    fails((m) => (m.surfaces!.web!.pair.url = '/auth/{{code}}?p={{password}}'), '/surfaces/web/pair/url forbidden');
    fails(
      (m) => m.engine!.launch.argv.push({ when: 'sessionId', args: ['{{password}}'] }),
      '/engine/launch/argv/6/args/0 forbidden',
    );
  });

  it('take a conditional only after the program, with args', () => {
    fails((m) => m.engine!.launch.argv.unshift({ when: 'port', args: ['x'] }), '/engine/launch/argv/0 type');
    fails((m) => m.engine!.launch.argv.push({ when: 'port', args: [] }), '/engine/launch/argv/6/args length');
    fails((m) => m.engine!.launch.argv.push({ when: 'port' } as never), '/engine/launch/argv/6/args required');
  });

  it('leave the host its env names', () => {
    for (const name of ['HOME', 'TMPDIR', 'LD_PRELOAD', 'PHONECANDO_BRIDGE_TOKEN']) {
      fails((m) => (m.engine!.launch.env![name] = 'x'), `/engine/launch/env/${name} reserved`);
    }
    fails((m) => (m.engine!.launch.env!['A-B'] = 'x'), '/engine/launch/env/A-B pattern');
  });
});

describe('engine', () => {
  it('needs a launch command and a style', () => {
    fails((m) => delete (m.engine as Partial<Manifest['engine'] & object>).launch, '/engine/launch required');
    fails((m) => delete (m.engine as Partial<Manifest['engine'] & object>).style, '/engine/style required');
  });

  it('keeps auth and readiness over HTTP to a server engine', () => {
    fails((m) => (m.engine!.style = 'tui'), '/engine/auth forbidden', '/engine/readiness/http forbidden');
    fails((m) => (m.engine!.readiness = { alive: { ms: 1 } }), '/engine/readiness/http required', '/engine/readiness/alive forbidden');
    fails((m) => (m.engine!.auth!.basic.user = 'a:b'), '/engine/auth/basic/user pattern');
  });

  it('reserves acp', () => {
    fails((m) => ((m.engine as unknown as { acp: object }).acp = {}), '/engine/acp reserved');
  });
});

describe('events, chats, idle', () => {
  it('names the SSE parser by a hook of this kind', () => {
    fails((m) => (m.hooks = ['codex.events']), '/hooks/0 mismatch', '/events/0/sse/parser mismatch');
    fails((m) => (m.hooks = ['events']), '/hooks/0 pattern');
  });

  it('reads the chat title at a JSON pointer', () => {
    fails((m) => (m.chats!.title.http.json = 'data.title'), '/chats/title/http/json pattern');
  });

  it('idles on a stream it has, for a sane time', () => {
    fails((m) => (m.idle!.quietSec = 0), '/idle/quietSec range');
    fails((m) => (m.idle!.quietSec = 1.5), '/idle/quietSec type');
    fails((m) => delete m.events, '/idle/from/0 mismatch');
  });
});

describe('surfaces', () => {
  it('needs the web surface for a web home', () => {
    fails((m) => delete m.surfaces!.web, '/surfaces/web required');
    ok((m) => {
      m.surfaces!.home = 'tui';
      delete m.surfaces!.web;
    });
  });

  it('pairs into a URL that carries the code', () => {
    fails((m) => (m.surfaces!.web!.pair.url = '/auth/connect/'), '/surfaces/web/pair/url required');
    fails((m) => (m.surfaces!.web!.pair.code = []), '/surfaces/web/pair/code length');
    fails((m) => ((m.surfaces!.web!.pair as { method: string }).method = 'GET'), '/surfaces/web/pair/method enum');
  });

  it('maps CSS variables onto palette roles only', () => {
    fails(
      (m) => ((m.surfaces!.web!.adapter.cssVars as Record<string, string>)['--v2-x'] = 'accent'),
      '/surfaces/web/adapter/cssVars/--v2-x enum',
    );
    fails((m) => (m.surfaces!.web!.adapter.cssVars.color = 'bg'), '/surfaces/web/adapter/cssVars/color pattern');
  });

  it('keeps adapter strings safe inside the scripts', () => {
    fails((m) => (m.surfaces!.web!.adapter.hide = ["a[x='y']"]), '/surfaces/web/adapter/hide/0 pattern');
    fails((m) => (m.surfaces!.web!.adapter.hide = ['a{color:red}']), '/surfaces/web/adapter/hide/0 pattern');
    fails((m) => (m.surfaces!.web!.adapter.colorSchemeKey = "k'"), '/surfaces/web/adapter/colorSchemeKey pattern');
  });

  it('takes the optional adapter fields as optional', () => {
    ok((m) => {
      const a = m.surfaces!.web!.adapter;
      delete a.colorSchemeKey;
      delete a.hide;
      delete a.sessionUrl;
    });
  });

  it('reads group 1 of the URL and title regexes', () => {
    fails((m) => (m.surfaces!.terminal!.chatTitle = '^OC \\| .+$'), '/surfaces/terminal/chatTitle pattern');
    fails((m) => (m.surfaces!.terminal!.chatTitle = '^OC (.+$'), '/surfaces/terminal/chatTitle pattern');
    fails((m) => (m.surfaces!.web!.adapter.sessionUrl = '/session/'), '/surfaces/web/adapter/sessionUrl pattern');
  });
});

describe('hooks and sign-in', () => {
  it('lists sign-in methods it knows', () => {
    fails((m) => (m.signIn = [{ method: 'oauth' as 'in-ui' }]), '/signIn/0/method enum');
    fails((m) => (m.signIn = [{ method: 'in-ui', note: '' }]), '/signIn/0/note length');
  });

  it('gives a user-added kind no hooks', () => {
    const htop = JSON.parse(readFileSync(new URL('../../schema/fixtures/valid/user-htop.json', import.meta.url), 'utf8'));
    const result = validate({ ...htop, hooks: ['user.htop.events'] }, { origin: 'user' });
    assert.ok(result.problems.some((p) => p.path === '/hooks' && p.code === 'forbidden'));
  });
});
