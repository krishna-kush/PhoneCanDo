// The CI wait on a fake clock: it waits only while CI is unfinished and
// nothing is red, and never past its limit.
//   node --test "scripts/release/**/*.test.mjs"
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stillRunning, waitForCi } from './wait.mjs';

const ci = (...blocks) => ({ rows: blocks, blocks, warns: [] });
const block = (name, state) => ({ name, state, decision: 'block' });
const GREEN = ci();
const RUNNING = ci(block('lre-ok', 'running'), block('Debug APK (play)', 'in_progress'));
const RED = ci(block('lre-ok', 'running'), block('ci-ok', 'failure'));

/**
 * Reads `answers` in turn (the last one repeats; an Error is thrown) on a
 * clock that sleeps instantly.
 */
function clock(answers) {
  let at = 0;
  let reads = 0;
  const lines = [];
  const opts = { limitMs: 10 * 60_000, sleep: (ms) => (at += ms), now: () => at, log: (line) => lines.push(line) };
  const read = () => {
    const answer = answers[Math.min(reads++, answers.length - 1)];
    if (answer instanceof Error) throw answer;
    return answer;
  };
  return { read, opts, lines, reads: () => reads, at: () => at };
}

test('still running: only unfinished checks block', () => {
  assert.equal(stillRunning(RUNNING), true);
  assert.equal(stillRunning(GREEN), false);
  assert.equal(stillRunning(RED), false);
});

test('waits through running reads, then returns the green one', () => {
  const c = clock([RUNNING, RUNNING, GREEN]);
  assert.equal(waitForCi(c.read, c.opts), GREEN);
  assert.equal(c.reads(), 3);
  assert.equal(c.at(), 2 * 60_000);
  assert.match(c.lines[0], /CI still running \(0 min waited\): lre-ok, Debug APK \(play\)/);
});

test('anything red ends the wait at once', () => {
  const c = clock([RUNNING, RED, GREEN]);
  assert.equal(waitForCi(c.read, c.opts), RED);
  assert.equal(c.reads(), 2);
});

test('green or red at the first read: no wait at all', () => {
  for (const first of [GREEN, RED]) {
    const c = clock([first]);
    assert.equal(waitForCi(c.read, c.opts), first);
    assert.equal(c.at(), 0);
    assert.deepEqual(c.lines, []);
  }
});

test('gives up at the limit and returns the running read for the preflight to refuse', () => {
  const c = clock([RUNNING]);
  assert.equal(waitForCi(c.read, c.opts), RUNNING);
  assert.equal(c.at(), 10 * 60_000);
  assert.match(c.lines.at(-1), /after 10 min: .*Not waiting any longer/);
});

test('a failed read while waiting is tried again; one at the first read or at the limit throws', () => {
  const down = new Error('TLS handshake timeout');
  const c = clock([RUNNING, down, GREEN]);
  assert.equal(waitForCi(c.read, c.opts), GREEN);
  assert.match(c.lines[1], /Could not read CI \(TLS handshake timeout\)\. Trying again in 1 min/);
  assert.throws(() => waitForCi(clock([down]).read, clock([down]).opts), /TLS/);
  const stuck = clock([RUNNING, down]);
  assert.throws(() => waitForCi(stuck.read, stuck.opts), /TLS/);
  assert.equal(stuck.at(), 10 * 60_000);
});
