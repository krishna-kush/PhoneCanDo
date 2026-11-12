// phonecando-event: the line format, the session sources, the 4 KiB cap,
// bad calls, and that it never blocks, with every POSIX shell on the host.
//   node --test agents/kit/scripts/phonecando-event.test.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { run, runWithOpenStdin, scriptPath, shells } from './shells.mjs';

const SCRIPT = 'phonecando-event';

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-event-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return { home: dir, events: join(dir, 'events') };
}

const lines = (file) => readFileSync(file, 'utf8').split('\n').slice(0, -1);

for (const shell of shells) {
  describe(`phonecando-event (${shell.name})`, () => {
    it('parses', () => {
      const [cmd, ...pre] = shell.argv;
      assert.equal(run({ argv: [cmd, ...pre, '-n'] }, SCRIPT, []).code, 0, scriptPath(SCRIPT));
    });

    it('appends name, session and message, the words joined by spaces', (t) => {
      const { events } = scratch(t);
      const env = { PHONECANDO_EVENTS: events, PHONECANDO_SESSION: 's-1' };
      assert.equal(run(shell, SCRIPT, ['Stop', 'all', 'done'], { env }).code, 0);
      assert.equal(run(shell, SCRIPT, ['Notification'], { env }).code, 0);
      assert.deepEqual(lines(events), ['Stop\ts-1\tall done', 'Notification\ts-1\t']);
    });

    it("takes the session from a hook's JSON on stdin", (t) => {
      const { events } = scratch(t);
      const input = '{\n  "hook_event_name": "Stop",\n  "session_id" : "abc-123",\n  "cwd": "/x"\n}\n';
      assert.equal(run(shell, SCRIPT, ['Stop'], { env: { PHONECANDO_EVENTS: events }, input }).code, 0);
      assert.deepEqual(lines(events), ['Stop\tabc-123\t']);
    });

    it('prefers PHONECANDO_SESSION over stdin', (t) => {
      const { events } = scratch(t);
      const env = { PHONECANDO_EVENTS: events, PHONECANDO_SESSION: 'env' };
      assert.equal(run(shell, SCRIPT, ['Stop'], { env, input: '{"session_id":"json"}' }).code, 0);
      assert.deepEqual(lines(events), ['Stop\tenv\t']);
    });

    it('returns within about a second when stdin stays open', async (t) => {
      const { events } = scratch(t);
      const { code, ms } = await runWithOpenStdin(shell, SCRIPT, ['Stop', 'hi'], { env: { PHONECANDO_EVENTS: events } });
      assert.equal(code, 0);
      assert.ok(ms < 3000, `took ${ms} ms`);
      assert.deepEqual(lines(events), ['Stop\t\thi']);
    });

    it('turns tabs and line breaks inside fields into spaces', (t) => {
      const { events } = scratch(t);
      const env = { PHONECANDO_EVENTS: events, PHONECANDO_SESSION: 'a\tb' };
      assert.equal(run(shell, SCRIPT, ['Stop', 'one\ttwo\r\nthree'], { env }).code, 0);
      assert.deepEqual(lines(events), ['Stop\ta b\tone two  three']);
    });

    it('cuts a line to 4 KiB, its newline included', (t) => {
      const { events } = scratch(t);
      assert.equal(run(shell, SCRIPT, ['Stop', 'x'.repeat(10_000)], { env: { PHONECANDO_EVENTS: events } }).code, 0);
      const bytes = readFileSync(events);
      assert.equal(bytes.length, 4096);
      assert.equal(bytes.at(-1), 0x0a);
      assert.equal(lines(events).length, 1);
    });

    it('refuses a bad call with 64 and writes nothing', (t) => {
      const { events } = scratch(t);
      for (const args of [[], [''], ['@open', 'x'], ['a b'], ['a\tb'], ['x'.repeat(65)]]) {
        assert.equal(run(shell, SCRIPT, args, { env: { PHONECANDO_EVENTS: events } }).code, 64, JSON.stringify(args));
      }
      assert.equal(existsSync(events), false);
      assert.equal(run(shell, SCRIPT, ['a.b_c:d-1'], { env: { PHONECANDO_EVENTS: events } }).code, 0);
    });

    it('makes the folder of the agent\'s events file', (t) => {
      const { home } = scratch(t);
      const events = join(home, '.phonecando/events-a2');
      assert.equal(run(shell, SCRIPT, ['Stop'], { env: { PHONECANDO_EVENTS: events } }).code, 0);
      assert.deepEqual(lines(events), ['Stop\t\t']);
    });

    it('does nothing, and succeeds, when no agent listens', (t) => {
      const { home } = scratch(t);
      for (const env of [{ HOME: home }, { HOME: home, PHONECANDO_EVENTS: '' }, {}]) {
        const r = run(shell, SCRIPT, ['Stop', 'hi'], { env, input: '{"session_id":"s"}' });
        assert.equal(r.code, 0, JSON.stringify(env));
        assert.equal(r.stderr, '');
      }
      assert.equal(existsSync(join(home, '.phonecando')), false);
      // A bad call is still one.
      assert.equal(run(shell, SCRIPT, ['bad name'], { env: { HOME: home } }).code, 64);
    });
  });
}
