// The tui engine's blocks (engine.ts, events.ts, surfaces.ts), one rule at
// a time on the claude-code fixture, which uses every one of them.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Manifest, PtyRule } from './types.ts';
import { validate } from './validate.ts';

const FIXTURE = new URL('../../schema/fixtures/valid/claude-code.json', import.meta.url);
type Tui = Manifest & { engine: NonNullable<Manifest['engine']> } & Record<string, unknown>;
const claude = (): Tui => JSON.parse(readFileSync(FIXTURE, 'utf8'));

function problems(change: (m: Tui) => void): string[] {
  const m = claude();
  change(m);
  return validate(m, { origin: 'bundled' }).problems.map((p) => `${p.path} ${p.code}`);
}

const ok = (change: (m: Tui) => void) => assert.deepEqual(problems(change), []);
const fails = (change: (m: Tui) => void, ...want: string[]) => {
  const got = problems(change);
  for (const w of want) assert.ok(got.includes(w), `${w} not in [${got.join(', ')}]`);
};
const rules = (m: Tui): PtyRule[] => (m.events![0] as { pty: { rules: PtyRule[] } }).pty.rules;

describe('tui readiness', () => {
  it('takes output or alive, each with defaults', () => {
    ok((m) => delete m.engine.readiness);
    ok((m) => (m.engine.readiness = { output: {} }));
    ok((m) => (m.engine.readiness = { alive: {} }));
    ok((m) => (m.engine.readiness = { alive: { ms: 0 } }));
  });

  it('names exactly one rule', () => {
    fails((m) => (m.engine.readiness = {} as never), '/engine/readiness required');
    fails((m) => (m.engine.readiness = { output: {}, alive: {} } as never), '/engine/readiness/alive forbidden');
  });

  it('waits a sane time', () => {
    fails((m) => (m.engine.readiness = { output: { settleMs: -1 } }), '/engine/readiness/output/settleMs range');
    fails((m) => (m.engine.readiness = { output: { timeoutSec: 0 } }), '/engine/readiness/output/timeoutSec range');
    fails((m) => (m.engine.readiness = { alive: { ms: 1.5 } }), '/engine/readiness/alive/ms type');
    fails((m) => (m.engine.readiness = { alive: { sec: 1 } } as never), '/engine/readiness/alive/sec unknown');
  });
});

describe('resume and launch', () => {
  it('appends resume args, or puts them in after the program', () => {
    ok((m) => (m.engine.resume = { args: ['resume', '--last'], at: 1 }));
    fails((m) => (m.engine.resume = { args: ['x'], at: 0 }), '/engine/resume/at range');
    fails((m) => (m.engine.resume = { args: [] }), '/engine/resume/args length');
    fails((m) => (m.engine.resume = { args: ['{{password}}'] }), '/engine/resume/args/0 forbidden');
    fails((m) => (m.engine.resume = {} as never), '/engine/resume/args required');
  });

  it('starts in a working directory', () => {
    fails((m) => (m.engine.launch.cwd = '{{password}}'), '/engine/launch/cwd forbidden');
    fails((m) => (m.engine.launch.cwd = '{{nope}}'), '/engine/launch/cwd unknown');
  });
});

describe('PTY rules', () => {
  it('map known signals to known events', () => {
    ok((m) => rules(m).push({ on: 'progress', event: 'working' }, { on: 'osc777', event: 'failed', match: 'error' }));
    fails((m) => (rules(m)[0].on = 'osc8' as never), '/events/0/pty/rules/0/on enum');
    fails((m) => (rules(m)[0].event = 'idle' as never), '/events/0/pty/rules/0/event enum');
  });

  it('match OSC text with a regex that needs no group; a bell has no text', () => {
    fails((m) => (rules(m)[1].match = '^(oops'), '/events/0/pty/rules/1/match pattern');
    fails((m) => (rules(m)[0].match = 'x'), '/events/0/pty/rules/0/match forbidden');
  });

  it('need at least one rule, each once, and one source per item', () => {
    fails((m) => rules(m).splice(0), '/events/0/pty/rules length');
    fails((m) => rules(m).push({ ...rules(m)[0] }), '/events/0/pty/rules unique');
    fails((m) => ((m.events![0] as Record<string, unknown>).sse = { path: '/e', parser: 'x.y' }), '/events/0/sse forbidden');
    fails((m) => (m.events = [{} as never]), '/events/0 required');
  });
});

describe('idle and surfaces', () => {
  it('idles on output, or on events once it has rules', () => {
    ok((m) => (m.idle!.from = ['output', 'events']));
    fails(
      (m) => {
        delete m.events;
        m.idle!.from = ['events'];
      },
      '/idle/from/0 mismatch',
    );
  });

  it('reads the window title with group 1', () => {
    fails((m) => (m.surfaces!.chatTitle = '^.+$'), '/surfaces/chatTitle pattern');
  });

  it('opens a shell, not a client', () => {
    fails((m) => (m.surfaces!.terminal!.shell = 'yes' as never), '/surfaces/terminal/shell type');
    fails(
      (m) => (m.surfaces!.terminal!.client = { argv: ['claude'] }),
      '/surfaces/terminal/client forbidden',
      '/surfaces/terminal/shell forbidden',
    );
    fails((m) => (m.surfaces!.terminal!.chatTitle = '^(.+)$'), '/surfaces/terminal/chatTitle mismatch');
  });

  it('keeps the window title to a tui engine', () => {
    const opencode = JSON.parse(readFileSync(new URL('../../schema/fixtures/valid/opencode.json', import.meta.url), 'utf8'));
    const result = validate({ ...opencode, surfaces: { ...opencode.surfaces, chatTitle: '^(.+)$' } }, { origin: 'bundled' });
    assert.ok(result.problems.some((p) => p.path === '/surfaces/chatTitle' && p.code === 'forbidden'));
  });
});
