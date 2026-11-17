// What the Choose agent step tells about a kind (about.ts), on the real
// opencode manifest.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Manifest } from './types.ts';
import { validate } from './validate.ts';

const MANIFEST = new URL('../../../native/opencode/agent.json', import.meta.url);
const opencode = (): Manifest => JSON.parse(readFileSync(MANIFEST, 'utf8'));

function problems(change: (m: Manifest) => void, origin: 'bundled' | 'user' = 'bundled'): string[] {
  const m = opencode();
  change(m);
  return validate(m, { origin }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (change: (m: Manifest) => void) => assert.deepEqual(problems(change), []);
const fails = (change: (m: Manifest) => void, ...want: string[]) => {
  const got = problems(change);
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};

describe('about', () => {
  it('may be left out, or hold only the day it was checked', () => {
    ok((m) => delete m.about);
    ok((m) => (m.about = { checked: '2026-11-17' }));
  });

  it('takes every part', () => {
    ok(
      (m) =>
        (m.about = {
          checked: '2026-11-17',
          maker: 'Somebody',
          links: { home: 'https://a.example', guide: 'https://a.example/docs', keys: 'https://a.example/k', plans: 'https://a.example/p' },
          free: { via: 'tier', note: 'A free key: 100 a day' },
          move: { keys: '/undo', does: 'Takes back its last commit' },
        }),
    );
  });

  it('needs its day, as YYYY-MM-DD', () => {
    fails((m) => (m.about = {} as Manifest['about']), '/about/checked required');
    fails((m) => (m.about = { checked: '2026-13-01' }), '/about/checked pattern');
    fails((m) => (m.about = { checked: '17 Nov 2026' }), '/about/checked pattern');
  });

  it('takes https links by their names only, at least one', () => {
    fails((m) => (m.about = { checked: '2026-11-17', links: { home: 'http://a.example' } }), '/about/links/home pattern');
    fails((m) => (m.about = { checked: '2026-11-17', links: { home: 'javascript:alert(1)' } }), '/about/links/home pattern');
    fails(
      (m) => (m.about = { checked: '2026-11-17', links: { docs: 'https://a.example' } as never }),
      '/about/links/docs unknown',
    );
    fails((m) => (m.about = { checked: '2026-11-17', links: {} }), '/about/links required');
  });

  it('says how it is free with a short note, or not at all', () => {
    fails((m) => (m.about = { checked: '2026-11-17', free: { via: 'trial', note: 'x' } as never }), '/about/free/via enum');
    fails((m) => (m.about = { checked: '2026-11-17', free: { via: 'models' } as never }), '/about/free/note required');
    fails((m) => (m.about = { checked: '2026-11-17', free: { via: 'models', note: 'x'.repeat(81) } }), '/about/free/note length');
  });

  it('takes a power move as what to type and what it does, both short', () => {
    fails((m) => (m.about = { checked: '2026-11-17', move: 'Does one thing' } as never), '/about/move type');
    fails((m) => (m.about = { checked: '2026-11-17', move: { keys: '/undo' } } as never), '/about/move/does required');
    fails(
      (m) => (m.about = { checked: '2026-11-17', move: { keys: 'x'.repeat(25), does: 'y' } }),
      '/about/move/keys length',
    );
  });

  it('knows no other part', () => {
    fails((m) => (m.about = { checked: '2026-11-17', stars: 3 } as never), '/about/stars unknown');
  });
});
