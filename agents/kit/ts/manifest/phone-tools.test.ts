// The setting that trusts our phone tools (phone-tools.ts), one rule at a
// time: on the codex fixture (trust in argv), the gemini-cli one (trust in
// a config file) and a user-added kind.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Manifest, Origin } from './types.ts';
import { validate } from './validate.ts';

const FIXTURES = new URL('../../schema/fixtures/valid/', import.meta.url);
type Loose = Manifest & Record<string, unknown>;
const read = (file: string): Loose => JSON.parse(readFileSync(new URL(file, FIXTURES), 'utf8'));

function problems(file: string, change: (m: Loose) => void, origin: Origin = 'bundled'): string[] {
  const m = read(file);
  change(m);
  return validate(m, { origin }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (got: string[]) => assert.deepEqual(got, []);
const fails = (got: string[], ...want: string[]) => {
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};

describe('phoneToolsTrust', () => {
  it('is required on a bundled kind with MCP phone tools, and only there', () => {
    fails(problems('codex.json', (m) => delete m.phoneToolsTrust), '/phoneToolsTrust required');
    fails(problems('gemini-cli.json', (m) => delete m.phoneToolsTrust), '/phoneToolsTrust required');
    // Our plugin's tools are trusted by the plugin itself.
    ok(problems('opencode.json', () => {}));
  });

  it('goes with MCP phone tools only', () => {
    for (const tools of ['plugin', 'none', undefined]) {
      fails(
        problems('codex.json', (m) => (tools ? (m.phoneTools = tools as never) : delete m.phoneTools)),
        '/phoneToolsTrust forbidden',
      );
    }
    ok(problems('codex.json', (m) => (m.phoneTools = 'mcp:argv')));
  });

  it('in argv: some launch arg holds it, a conditional one too', () => {
    fails(problems('codex.json', (m) => m.engine!.launch.argv.splice(1)), '/phoneToolsTrust/has mismatch');
    ok(
      problems('codex.json', (m) => {
        const trust = m.engine!.launch.argv.splice(1);
        m.engine!.launch.argv.push({ when: 'bridgeUrl', args: trust as string[] });
      }),
    );
    // Text the launch does not hold, though it starts like what it does.
    fails(problems('codex.json', (m) => (m.phoneToolsTrust!.has = 'approve"x')), '/phoneToolsTrust/has mismatch');
  });

  it('in a file: needs the config folder and a safe path inside it', () => {
    ok(problems('gemini-cli.json', (m) => (m.phoneToolsTrust!.in = 'nested/settings.json')));
    fails(problems('gemini-cli.json', (m) => delete m.config!.dir), '/config/dir required');
    fails(problems('gemini-cli.json', (m) => delete m.config), '/config/dir required');
    for (const path of ['/etc/settings.json', '../settings.json', 'a//b', '']) {
      fails(problems('gemini-cli.json', (m) => (m.phoneToolsTrust!.in = path)), '/phoneToolsTrust/in pattern');
    }
  });

  it('holds in and has, has a short non-empty text', () => {
    fails(problems('codex.json', (m) => (m.phoneToolsTrust = { in: 'argv' } as never)), '/phoneToolsTrust/has required');
    fails(problems('codex.json', (m) => (m.phoneToolsTrust = { has: 'x' } as never)), '/phoneToolsTrust/in required');
    fails(problems('codex.json', (m) => ((m.phoneToolsTrust as unknown as Record<string, unknown>).also = 1)), '/phoneToolsTrust/also unknown');
    fails(problems('codex.json', (m) => (m.phoneToolsTrust!.has = '')), '/phoneToolsTrust/has length');
    fails(problems('codex.json', (m) => (m.phoneToolsTrust!.has = 'x'.repeat(257))), '/phoneToolsTrust/has length');
    fails(problems('codex.json', (m) => (m.phoneToolsTrust = 'argv' as never)), '/phoneToolsTrust type');
  });

  it('may be left out of a user-added kind, which trusts only in argv', () => {
    const tools = (m: Loose) => {
      m.phoneTools = 'mcp:argv';
      m.engine!.launch.argv.push('--trust', 'phonecando');
    };
    ok(problems('user-top.json', tools, 'user'));
    ok(problems('user-top.json', (m) => (tools(m), (m.phoneToolsTrust = { in: 'argv', has: '--trust' })), 'user'));
    fails(
      problems('user-top.json', (m) => (tools(m), (m.phoneToolsTrust = { in: 'settings.json', has: 'x' })), 'user'),
      '/phoneToolsTrust/in forbidden',
    );
  });
});
