// The local-model block (models.ts) on the real opencode manifest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Manifest } from './types.ts';
import { validate } from './validate.ts';

const MANIFEST = new URL('../../../native/opencode/agent.json', import.meta.url);
const opencode = (): Manifest => JSON.parse(readFileSync(MANIFEST, 'utf8'));

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

describe('models', () => {
  it('takes env and args per API, the key in env only', () => {
    ok((m) => {
      m.models = {
        anthropic: { env: { ANTHROPIC_BASE_URL: '{{baseUrl}}', ANTHROPIC_AUTH_TOKEN: '{{modelKey}}' } },
        'openai-chat': { args: ['--model', '{{model}}', '--ctx={{contextWindow}}'] },
      };
    });
  });

  it('refuses an unknown API, an empty block and an empty wiring', () => {
    fails((m) => {
      m.models = { gemini: { env: { A: 'b' } } } as Manifest['models'];
    }, '/models/gemini enum');
    fails((m) => {
      m.models = {};
    }, '/models required');
    fails((m) => {
      m.models = { anthropic: {} };
    }, '/models/anthropic required');
  });

  it('keeps the key out of args and engine placeholders out of a model block', () => {
    fails((m) => {
      m.models = { anthropic: { args: ['--key', '{{modelKey}}'] } };
    }, '/models/anthropic/args/1 forbidden');
    fails((m) => {
      m.models = { anthropic: { env: { X: '{{password}}' } } };
    }, '/models/anthropic/env/X unknown');
    fails((m) => {
      m.engine!.launch.env!.X = '{{model}}';
    }, '/engine/launch/env/X unknown');
  });

  it('refuses env names the host owns', () => {
    fails((m) => {
      m.models = { anthropic: { env: { PHONECANDO_X: '{{baseUrl}}' } } };
    }, '/models/anthropic/env/PHONECANDO_X reserved');
  });
});
