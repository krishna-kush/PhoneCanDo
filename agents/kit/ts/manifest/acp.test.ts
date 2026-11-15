// A tui engine's ACP mode (acp.ts), one rule at a time on the
// claude-code-acp fixture, which has every part of the block.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Acp, Manifest } from './types.ts';
import { validate } from './validate.ts';

const FIXTURES = new URL('../../schema/fixtures/valid/', import.meta.url);
type Tui = Manifest & { engine: NonNullable<Manifest['engine']> & { acp: Acp } } & Record<string, unknown>;
const read = (file: string): Tui => JSON.parse(readFileSync(new URL(file, FIXTURES), 'utf8'));

function problems(change: (m: Tui) => void, file = 'claude-code-acp.json', origin: 'bundled' | 'user' = 'bundled'): string[] {
  const m = read(file);
  change(m);
  return validate(m, { origin }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (change: (m: Tui) => void) => assert.deepEqual(problems(change), []);
const fails = (change: (m: Tui) => void, ...want: string[]) => {
  const got = problems(change);
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};

describe('acp mode', () => {
  it('needs only its argv', () => {
    ok((m) => (m.engine.acp = { argv: ['/root/.local/bin/qwen', '--acp'] }));
    fails((m) => (m.engine.acp = {} as Acp), '/engine/acp/argv required');
    fails((m) => ((m.engine.acp as unknown as Record<string, unknown>).cwd = '{{projectDir}}'), '/engine/acp/cwd unknown');
  });

  it('is for a tui engine only', () => {
    const opencode = JSON.parse(readFileSync(new URL('opencode.json', FIXTURES), 'utf8'));
    opencode.engine.acp = { argv: ['{{libDir}}/liboc-engine.so', 'acp'] };
    const got = validate(opencode, { origin: 'bundled' }).problems.map((p) => `${p.path} ${p.code}`);
    assert.ok(got.includes('/engine/acp forbidden'), got.join(', '));
  });

  it('takes argv as a launch does, without a chat id, a prompt or the password', () => {
    ok((m) => (m.engine.acp.argv = ['claude-agent-acp', { when: 'bridgeUrl', args: ['--mcp', '{{bridgeUrl}}/mcp'] }]));
    fails((m) => (m.engine.acp.argv = [{ when: 'bridgeUrl', args: ['x'] }]), '/engine/acp/argv/0 type');
    fails((m) => (m.engine.acp.argv = ['claude-agent-acp', '{{chatId}}']), '/engine/acp/argv/1 forbidden');
    fails((m) => (m.engine.acp.argv = ['claude-agent-acp', '{{prompt}}']), '/engine/acp/argv/1 unknown');
    fails((m) => (m.engine.acp.argv = ['claude-agent-acp', '{{password}}']), '/engine/acp/argv/1 forbidden');
    fails((m) => (m.engine.acp.argv = ['claude-agent-acp', '{{stateDir}}']), '/engine/acp/argv/1 forbidden');
    fails((m) => (m.engine.acp.argv = []), '/engine/acp/argv length');
  });

  it('takes env as a launch does', () => {
    ok((m) => (m.engine.acp.env = { KEY: '{{password}}', DIR: '{{projectDir}}' }));
    fails((m) => (m.engine.acp.env = { HOME: '/x' }), '/engine/acp/env/HOME reserved');
    fails((m) => (m.engine.acp.env = { 'A-B': 'x' }), '/engine/acp/env/A-B pattern');
    fails((m) => (m.engine.acp.env = { A: '{{chatId}}' }), '/engine/acp/env/A forbidden');
  });

  it('gets the phone tools in its session or from its config', () => {
    ok((m) => (m.engine.acp.tools = 'config'));
    ok((m) => delete m.engine.acp.tools);
    fails((m) => (m.engine.acp.tools = 'argv' as never), '/engine/acp/tools enum');
  });

  it('sets at most 8 short session options', () => {
    const options = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`o${i}`, 'v']));
    ok((m) => (m.engine.acp.options = options(8)));
    fails((m) => (m.engine.acp.options = options(9)), '/engine/acp/options length');
    fails((m) => (m.engine.acp.options = { mode: '' }), '/engine/acp/options/mode length');
    fails((m) => (m.engine.acp.options = { mode: 'x'.repeat(65) }), '/engine/acp/options/mode length');
    fails((m) => (m.engine.acp.options = { ['x'.repeat(65)]: 'v' }), `/engine/acp/options/${'x'.repeat(65)} length`);
    fails((m) => (m.engine.acp.options = { '': 'v' }), '/engine/acp/options/ length');
    fails((m) => (m.engine.acp.options = { mode: 1 } as never), '/engine/acp/options/mode type');
    fails((m) => (m.engine.acp.options = [] as never), '/engine/acp/options type');
  });

  it('takes meta as JSON whose strings are env-value templates, up to 4 KiB', () => {
    ok((m) => (m.engine.acp.meta = { a: { list: ['{{home}}/x', 1, true, null], key: '{{password}}' } }));
    fails((m) => (m.engine.acp.meta = { a: { list: ['x', '{{nope}}'] } }), '/engine/acp/meta/a/list/1 unknown');
    fails((m) => (m.engine.acp.meta = { 'a/b': '{{chatId}}' }), '/engine/acp/meta/a~1b forbidden');
    fails((m) => (m.engine.acp.meta = { a: '{{stateDir}}' }), '/engine/acp/meta/a forbidden');
    fails((m) => (m.engine.acp.meta = [] as never), '/engine/acp/meta type');
    const big = Object.fromEntries(['a', 'b', 'c', 'd'].map((k) => [k, 'x'.repeat(1020)]));
    fails((m) => (m.engine.acp.meta = big), '/engine/acp/meta too-large');
  });

  it('opens a given chat with {{chatId}} as one whole arg, once', () => {
    ok((m) => (m.engine.acp.chat = { args: ['--resume', '{{chatId}}'] }));
    ok((m) => (m.engine.acp.chat = { args: ['{{chatId}}', '{{projectDir}}'], at: 2 }));
    fails((m) => (m.engine.acp.chat = { args: ['--resume={{chatId}}'] }), '/engine/acp/chat/args mismatch');
    fails((m) => (m.engine.acp.chat = { args: ['--resume'] }), '/engine/acp/chat/args mismatch');
    fails((m) => (m.engine.acp.chat = { args: ['{{chatId}}', '{{chatId}}'] }), '/engine/acp/chat/args mismatch');
    fails((m) => (m.engine.acp.chat = { args: ['{{chatId}}', '{{password}}'] }), '/engine/acp/chat/args/1 forbidden');
    fails((m) => (m.engine.acp.chat = { args: ['{{chatId}}', '{{prompt}}'] }), '/engine/acp/chat/args/1 unknown');
    fails((m) => (m.engine.acp.chat = { args: ['{{chatId}}'], at: 0 }), '/engine/acp/chat/at range');
    fails((m) => (m.engine.acp.chat = { args: [] }), '/engine/acp/chat/args length');
    fails((m) => (m.engine.acp.chat = {} as never), '/engine/acp/chat/args required');
    fails((m) => (m.engine.acp.chat = { args: ['{{chatId}}'], last: true } as never), '/engine/acp/chat/last unknown');
  });

  it('puts the chat args past a shell script\'s $0', () => {
    const script = (at: number) => (m: Tui) => {
      m.engine.launch = { argv: ['sh', '-c', 'exec claude "$@"', 'claude'], cwd: '{{projectDir}}' };
      m.engine.acp.chat = { args: ['{{chatId}}'], at };
    };
    ok(script(4));
    fails(script(2), '/engine/acp/chat/at range');
  });

  it('keeps {{chatId}} out of every other template', () => {
    fails((m) => (m.engine.launch.argv = ['/root/.local/bin/claude', '{{chatId}}']), '/engine/launch/argv/1 forbidden');
    fails((m) => (m.engine.resume = { args: ['--resume', '{{chatId}}'] }), '/engine/resume/args/1 forbidden');
    fails((m) => (m.engine.prompt = { args: ['{{prompt}}', '{{chatId}}'] }), '/engine/prompt/args/1 forbidden');
  });

  it('runs an image kind\'s program in the image', () => {
    ok((m) => (m.engine.acp.argv = ['qwen', '--acp']));
    fails((m) => (m.engine.acp.argv = ['{{home}}/bin/qwen']), '/engine/acp/argv/0 pattern');
    fails((m) => (m.engine.acp.argv = ['bin/qwen']), '/engine/acp/argv/0 pattern');
  });

  it('keeps PATH to the host for a user-added kind', () => {
    const user = (env: Record<string, string>) =>
      problems((m) => (m.engine.acp = { argv: ['top', '-b'], env }), 'user-top-acp.json', 'user');
    assert.deepEqual(user({ TOP_MODE: 'acp' }), []);
    assert.ok(user({ PATH: '/opt/bin' }).includes('/engine/acp/env/PATH reserved'));
    // A bundled kind may set it.
    ok((m) => (m.engine.acp.env = { PATH: '/opt/bin:${PATH}' }));
  });
});
