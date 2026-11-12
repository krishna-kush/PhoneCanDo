// phonecando-inbox: delivery from pending/ (output, exit code, receipt),
// the claim race, bad calls, --wait (timeout, wake, newest waiter wins) and
// --cancel, with every POSIX shell on the host.
//   node --test agents/kit/scripts/phonecando-inbox.test.mjs
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { run, scriptPath, shells, start } from './shells.mjs';

const SCRIPT = 'phonecando-inbox';
const STOP_OUT = '{"decision":"block","reason":"<agent-message from=\\"A\\">\\nhi\\n</agent-message>"}\n';

function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'kit-inbox-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const inbox = join(dir, '.phonecando/inbox-a1');
  mkdirSync(inbox, { recursive: true });
  const events = join(dir, '.phonecando/events-a1');
  return { inbox, events, env: { PHONECANDO_INBOX: inbox, PHONECANDO_EVENTS: events } };
}

// As the runner writes it: into a temp folder, then renamed into place.
function pending(inbox, files) {
  const tmp = join(inbox, `.pending-${process.hrtime.bigint()}`);
  mkdirSync(tmp);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(tmp, name), text);
  renameSync(tmp, join(inbox, 'pending'));
}

const set = (extra = {}) => ({ ids: '12\n13\n', 'messages.jsonl': '{"id":12}\n{"id":13}\n', 'Stop.out': STOP_OUT, ...extra });
const receipts = (events) => (existsSync(events) ? readFileSync(events, 'utf8').split('\n').slice(0, -1) : []);
const waiterOf = (inbox) => (existsSync(join(inbox, 'waiter')) ? readFileSync(join(inbox, 'waiter'), 'utf8').trim() : null);

async function until(what, check, ms = 5000) {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) assert.fail(`timed out waiting for ${what}`);
    await sleep(25);
  }
}

for (const shell of shells) {
  describe(`phonecando-inbox (${shell.name})`, () => {
    it('parses', () => {
      const [cmd, ...pre] = shell.argv;
      assert.equal(run({ argv: [cmd, ...pre, '-n'] }, SCRIPT, []).code, 0, scriptPath(SCRIPT));
    });

    it('does nothing, and succeeds, when no agent listens', (t) => {
      const { inbox } = scratch(t);
      pending(inbox, set({ wake: '' }));
      for (const env of [{}, { PHONECANDO_INBOX: '' }]) {
        for (const args of [['Stop'], ['--wait', 'Stop', '1'], ['--cancel']]) {
          const r = run(shell, SCRIPT, args, { env });
          assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', ''], JSON.stringify({ env, args }));
        }
      }
      assert.ok(existsSync(join(inbox, 'pending/ids')));
    });

    it('prints nothing with nothing pending, or nothing for this event', (t) => {
      const { inbox, events, env } = scratch(t);
      assert.deepEqual(run(shell, SCRIPT, ['Stop'], { env }), { code: 0, stdout: '', stderr: '' });
      pending(inbox, set());
      assert.deepEqual(run(shell, SCRIPT, ['PostToolUse'], { env }), { code: 0, stdout: '', stderr: '' });
      // The set stays for the hook it has output for.
      assert.ok(existsSync(join(inbox, 'pending/Stop.out')));
      assert.deepEqual(receipts(events), []);
    });

    it('claims the set: prints its output, writes the receipt, leaves nothing behind', (t) => {
      const { inbox, events, env } = scratch(t);
      pending(inbox, set());
      assert.deepEqual(run(shell, SCRIPT, ['Stop'], { env }), { code: 0, stdout: STOP_OUT, stderr: '' });
      assert.deepEqual(receipts(events), ['@inbox\t12 13']);
      assert.deepEqual(readdirSync(inbox), []);
      // Delivered once.
      assert.deepEqual(run(shell, SCRIPT, ['Stop'], { env }), { code: 0, stdout: '', stderr: '' });
      assert.deepEqual(receipts(events), ['@inbox\t12 13']);
    });

    it("exits with the event's code, its output then on stderr", (t) => {
      const { inbox, events, env } = scratch(t);
      pending(inbox, set({ 'Stop.exit': '2\n' }));
      assert.deepEqual(run(shell, SCRIPT, ['Stop'], { env }), { code: 2, stdout: '', stderr: STOP_OUT });
      assert.deepEqual(receipts(events), ['@inbox\t12 13']);
      // A code that is no number in 0..255 is 0.
      for (const bad of ['x', '256', '-1', '']) {
        pending(inbox, set({ 'Stop.exit': bad, ids: '14' }));
        const r = run(shell, SCRIPT, ['Stop'], { env });
        assert.deepEqual([r.code, r.stdout], [0, STOP_OUT], JSON.stringify(bad));
      }
    });

    it('still prints with no events file, and writes no receipt without ids', (t) => {
      const { inbox, events } = scratch(t);
      pending(inbox, set());
      assert.deepEqual(run(shell, SCRIPT, ['Stop'], { env: { PHONECANDO_INBOX: inbox } }).stdout, STOP_OUT);
      pending(inbox, set({ ids: '\n' }));
      assert.deepEqual(run(shell, SCRIPT, ['Stop'], { env: { PHONECANDO_INBOX: inbox, PHONECANDO_EVENTS: events } }).stdout, STOP_OUT);
      assert.deepEqual(receipts(events), []);
    });

    it('of hooks that run at once, one gets the set', async (t) => {
      const { inbox, events, env } = scratch(t);
      pending(inbox, set());
      const runs = await Promise.all(Array.from({ length: 8 }, () => start(shell, SCRIPT, ['Stop'], { env }).done));
      assert.deepEqual(runs.map((r) => r.code), Array(8).fill(0));
      assert.equal(runs.filter((r) => r.stdout === STOP_OUT).length, 1);
      assert.equal(runs.filter((r) => r.stdout !== '' && r.stdout !== STOP_OUT).length, 0);
      assert.deepEqual(receipts(events), ['@inbox\t12 13']);
      assert.deepEqual(readdirSync(inbox), []);
    });

    it('refuses a bad call with 64', (t) => {
      const { inbox, env } = scratch(t);
      pending(inbox, set({ wake: '' }));
      const bad = [
        [], [''], ['a b'], ['../x'], ['.x'], ['-x'], ['x'.repeat(65)], ['Stop', 'more'],
        ['--wait'], ['--wait', 'Stop'], ['--wait', 'Stop', '0'], ['--wait', 'Stop', '01'], ['--wait', 'Stop', 'x'],
        ['--wait', 'Stop', '86401'], ['--wait', 'a/b', '5'], ['--wait', 'Stop', '5', 'x'], ['--cancel', 'x'],
      ];
      for (const args of bad) assert.equal(run(shell, SCRIPT, args, { env }).code, 64, JSON.stringify(args));
      assert.ok(existsSync(join(inbox, 'pending/ids')));
      assert.equal(run(shell, SCRIPT, ['a.b_c:d-1'], { env }).code, 0);
    });

    it('--wait times out silently, leaving messages that may not wake', async (t) => {
      const { inbox, events, env } = scratch(t);
      pending(inbox, set());
      const r = await start(shell, SCRIPT, ['--wait', 'Stop', '1'], { env }).done;
      assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', '']);
      assert.ok(r.ms < 4000, `took ${r.ms} ms`);
      assert.ok(existsSync(join(inbox, 'pending/Stop.out')));
      assert.equal(waiterOf(inbox), null);
      assert.deepEqual(receipts(events), []);
    });

    it('--wait hands over messages that may wake, once they come', async (t) => {
      const { inbox, events, env } = scratch(t);
      const waiter = start(shell, SCRIPT, ['--wait', 'Stop', '20'], { env });
      await until('the waiter file', () => waiterOf(inbox) === String(waiter.pid));
      await sleep(300);
      pending(inbox, set({ 'Stop.exit': '2', wake: '' }));
      const r = await waiter.done;
      assert.deepEqual([r.code, r.stdout, r.stderr], [2, '', STOP_OUT]);
      assert.ok(r.ms < 6000, `took ${r.ms} ms`);
      assert.deepEqual(receipts(events), ['@inbox\t12 13']);
      assert.deepEqual(readdirSync(inbox), []);
    });

    it('--wait: the newest waiter wins', async (t) => {
      const { inbox, env } = scratch(t);
      const first = start(shell, SCRIPT, ['--wait', 'Stop', '20'], { env });
      await until('the first waiter', () => waiterOf(inbox) === String(first.pid));
      const second = start(shell, SCRIPT, ['--wait', 'Stop', '20'], { env });
      const gone = await first.done;
      assert.deepEqual([gone.code, gone.stdout, gone.stderr], [0, '', '']);
      assert.ok(gone.ms < 6000, `took ${gone.ms} ms`);
      // The first left the newest's file alone, and the newest still claims.
      assert.equal(waiterOf(inbox), String(second.pid));
      pending(inbox, set({ wake: '' }));
      const r = await second.done;
      assert.deepEqual([r.code, r.stdout], [0, STOP_OUT]);
      assert.equal(waiterOf(inbox), null);
    });

    it('--cancel ends a waiter left running', async (t) => {
      const { inbox, env } = scratch(t);
      assert.deepEqual(run(shell, SCRIPT, ['--cancel'], { env }), { code: 0, stdout: '', stderr: '' });
      const waiter = start(shell, SCRIPT, ['--wait', 'Stop', '20'], { env });
      await until('the waiter file', () => waiterOf(inbox) === String(waiter.pid));
      assert.deepEqual(run(shell, SCRIPT, ['--cancel'], { env }), { code: 0, stdout: '', stderr: '' });
      const r = await waiter.done;
      assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', '']);
      assert.ok(r.ms < 6000, `took ${r.ms} ms`);
      assert.equal(waiterOf(inbox), null);
      // What came after the cancel waits for the agent's next hook.
      pending(inbox, set({ wake: '' }));
      await sleep(200);
      assert.ok(existsSync(join(inbox, 'pending/wake')));
    });

    it('--wait makes the inbox folder it waits in', async (t) => {
      const { inbox, env } = scratch(t);
      rmSync(inbox, { recursive: true });
      const r = await start(shell, SCRIPT, ['--wait', 'Stop', '1'], { env }).done;
      assert.equal(r.code, 0);
      assert.deepEqual(readdirSync(inbox), []);
    });
  });
}
