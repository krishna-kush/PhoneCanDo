// The inbox block (inbox.ts) on the real opencode manifest (a server
// engine) and on a made-up tui image kind.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Inbox, Manifest, Origin } from './types.ts';
import { validate } from './validate.ts';

const OPENCODE = new URL('../../../native/opencode/agent.json', import.meta.url);
const server = (): Manifest => {
  const m: Manifest = JSON.parse(readFileSync(OPENCODE, 'utf8'));
  delete m.inbox;
  return m;
};
const tui = (): Manifest => ({
  schema: 1,
  id: 'demo',
  label: 'Demo',
  version: '1',
  type: 'image',
  channels: ['full'],
  stability: 'preview',
  licence: { spdx: null, redistributed: false, source: 'https://example.com' },
  requires: { linux: 'required' },
  engine: { style: 'tui', launch: { argv: ['demo'] } },
  phoneTools: 'none',
});

function problems(base: () => Manifest, inbox: unknown, origin: Origin = 'bundled'): string[] {
  const m = base();
  m.inbox = inbox as Inbox;
  return validate(m, { origin }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (base: () => Manifest, inbox: unknown) => assert.deepEqual(problems(base, inbox), []);
const fails = (base: () => Manifest, inbox: unknown, ...want: string[]) => {
  const got = problems(base, inbox);
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};

const DELIVER = { method: 'POST', path: '/api/session/{{sessionId}}/queue', body: { text: '{{messages}}' } };

describe('inbox', () => {
  it('takes hooks, a reader and a wake mode they support', () => {
    ok(tui, {
      hooks: {
        PostToolUse: { format: 'json', template: { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: '{{messages}}' } } },
        Stop: { format: 'text', template: 'Messages:\n{{messages}}', exit: 2 },
        AfterTool: { format: 'json', template: '{"systemMessage":"{{messages}}"}' },
      },
      wake: 'hook',
    });
    ok(tui, { reader: true, wake: 'reader' });
    ok(tui, { reader: true });
    // A user's kind may have hooks of its own.
    assert.deepEqual(problems(() => ({ ...tui(), id: 'user.demo' }), { hooks: { Stop: { format: 'text', template: '{{messages}}' } } }, 'user'), []);
  });

  it('takes server calls on a server engine', () => {
    ok(server, { server: { deliver: DELIVER, wake: { ...DELIVER, path: '/api/session/{{sessionId}}/prompt', body: { parts: [{ type: 'text', text: '{{messages}}' }], n: 1 } } }, wake: 'server' });
    ok(server, { server: { deliver: { method: 'POST', path: '/inbox', body: { chat: '{{sessionId}}', text: 'From agents: {{messages}}' } } }, reader: true });
  });

  it('needs a way in', () => {
    fails(tui, {}, '/inbox required');
    fails(tui, { reader: false }, '/inbox required');
    fails(tui, { wake: 'hook' }, '/inbox required', '/inbox/hooks required');
    fails(tui, { hooks: {} }, '/inbox/hooks length');
    fails(tui, [], '/inbox type');
    fails(tui, { reader: true, push: true }, '/inbox/push unknown');
  });

  it('needs what its wake mode uses', () => {
    fails(tui, { reader: true, wake: 'hook' }, '/inbox/hooks required');
    fails(server, { server: { deliver: DELIVER }, wake: 'server' }, '/inbox/server/wake required');
    fails(tui, { hooks: { Stop: { format: 'text', template: '{{messages}}' } }, wake: 'reader' }, '/inbox/reader required');
    fails(tui, { reader: true, wake: 'always' }, '/inbox/wake enum');
    fails(tui, { reader: 'yes' }, '/inbox/reader type');
  });

  it('names hook events as file names', () => {
    for (const name of ['../x', '.x', 'a/b', 'a b', 'x'.repeat(65)]) {
      const got = problems(tui, { hooks: { [name]: { format: 'text', template: '{{messages}}' } } });
      assert.ok(got.some((p) => p.endsWith(' pattern') || p.endsWith(' length')), `${name}: ${got.join(', ')}`);
    }
  });

  it('fills {{messages}} into every hook template, and nothing else', () => {
    const hook = (h: unknown) => ({ hooks: { Stop: h } });
    fails(tui, hook({ format: 'text', template: 'nothing' }), '/inbox/hooks/Stop/template required');
    fails(tui, hook({ format: 'json', template: { a: 'x', n: 1 } }), '/inbox/hooks/Stop/template required');
    fails(tui, hook({ format: 'text', template: '{{messages}} {{sessionId}}' }), '/inbox/hooks/Stop/template unknown');
    fails(tui, hook({ format: 'json', template: { a: ['{{messages}}', '{{password}}'] } }), '/inbox/hooks/Stop/template/a/1 unknown');
    fails(tui, hook({ format: 'text', template: '{{messages}} {{' }), '/inbox/hooks/Stop/template pattern');
    fails(tui, hook({ format: 'text' }), '/inbox/hooks/Stop/template required');
    fails(tui, hook({ template: '{{messages}}' }), '/inbox/hooks/Stop/format required');
    fails(tui, hook({ format: 'yaml', template: '{{messages}}' }), '/inbox/hooks/Stop/format enum');
    fails(tui, hook({ format: 'text', template: ['{{messages}}'] }), '/inbox/hooks/Stop/template type');
    fails(tui, hook({ format: 'text', template: '{{messages}}', exit: 256 }), '/inbox/hooks/Stop/exit range');
    fails(tui, hook({ format: 'text', template: '{{messages}}', exit: 1.5 }), '/inbox/hooks/Stop/exit type');
  });

  it('keeps a json template JSON, with the messages in one of its strings', () => {
    const json = (template: unknown) => ({ hooks: { Stop: { format: 'json', template } } });
    ok(tui, json('{"decision":"block","reason":"Agents wrote:\\n{{messages}}"}'));
    fails(tui, json('{"reason": {{messages}}}'), '/inbox/hooks/Stop/template mismatch');
    fails(tui, json('{"{{messages}}": 1}'), '/inbox/hooks/Stop/template mismatch');
    fails(tui, json('{"reason":"{{messages}}"'), '/inbox/hooks/Stop/template mismatch');
    // An object is JSON.
    fails(tui, { hooks: { Stop: { format: 'text', template: { a: '{{messages}}' } } } }, '/inbox/hooks/Stop/template mismatch');
  });

  it('posts only to a server engine, with the messages in the body', () => {
    fails(tui, { server: { deliver: DELIVER } }, '/inbox/server forbidden');
    fails(server, { server: { wake: DELIVER } }, '/inbox/server/deliver required');
    fails(server, { server: { deliver: { ...DELIVER, body: { text: 'x' } } } }, '/inbox/server/deliver/body required');
    fails(server, { server: { deliver: { ...DELIVER, body: '{{messages}}' } } }, '/inbox/server/deliver/body type');
    fails(server, { server: { deliver: { ...DELIVER, method: 'GET' } } }, '/inbox/server/deliver/method enum');
    fails(server, { server: { deliver: { ...DELIVER, path: 'api' } } }, '/inbox/server/deliver/path pattern');
    fails(server, { server: { deliver: { ...DELIVER, path: '/{{messages}}' } } }, '/inbox/server/deliver/path unknown');
    fails(server, { server: { deliver: { ...DELIVER, body: { t: '{{messages}}', p: '{{password}}' } } } }, '/inbox/server/deliver/body/p unknown');
    fails(server, { server: { deliver: { method: 'POST', path: '/' } } }, '/inbox/server/deliver/body required');
    fails(server, { server: { deliver: DELIVER, extra: {} } }, '/inbox/server/extra unknown');
  });
});
