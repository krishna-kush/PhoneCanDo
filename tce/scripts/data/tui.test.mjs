// Drives the interactive view with fake terminal streams: keys in, the last
// painted frame out (rebuilt from the absolute cursor moves tui.mjs writes).
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { test } from 'node:test';
import { buildModel } from './model.mjs';
import { makeStyle, stripAnsi, width } from './paint.mjs';
import { NOW, sampleAe, sampleResults } from './sample.test-support.mjs';
import { nextWindow, runTui } from './tui.mjs';

const COLS = 100;
const ROWS = 40;

function terminal() {
  const stdin = new PassThrough();
  stdin.isTTY = true;
  stdin.raw = [];
  stdin.setRawMode = (on) => stdin.raw.push(on);
  let out = '';
  const stdout = new Writable({
    write(chunk, _enc, cb) {
      out += chunk;
      cb();
    },
  });
  Object.assign(stdout, { isTTY: true, columns: COLS, rows: ROWS });
  /** The rows of the last painted frame, without styles. */
  const screen = () => {
    const frames = out.split('\x1b[?25l');
    const rows = [];
    for (const m of frames[frames.length - 1].matchAll(/\x1b\[(\d+);1H(.*?)\x1b\[K/gs)) rows[Number(m[1]) - 1] = stripAnsi(m[2]);
    return rows;
  };
  return { stdin, stdout, screen, output: () => out };
}

async function until(check, what) {
  for (let i = 0; i < 400; i++) {
    if (check()) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.fail(`timed out waiting for ${what}`);
}

const has = (t, text) => t.screen().some((row) => row?.includes(text));

test('nextWindow cycles 7 → 30 → 90 → 7', () => {
  assert.equal(nextWindow(7), 30);
  assert.equal(nextWindow(30), 90);
  assert.equal(nextWindow(90), 7);
  assert.equal(nextWindow(14), 30);
});

test('tabs, list selection, details, window, testers, help and quit', async () => {
  const t = terminal();
  const calls = [];
  const load = async ({ days, testers }) => {
    calls.push({ days, testers });
    return buildModel({ results: sampleResults(), ae: sampleAe(), now: NOW, days, testers, source: 'cf CLI', database: 'phonecando-stats', rowsRead: 321 });
  };
  const done = runTui({ load, days: 30, testers: false, style: makeStyle(true), stdin: t.stdin, stdout: t.stdout });

  await until(() => has(t, '321 rows read'), 'the first frame');
  assert.ok(has(t, 'PhoneCanDo'));
  assert.ok(has(t, '1 Overview'));
  assert.ok(has(t, 'Devices'));
  assert.ok(t.screen().every((row) => width(row ?? '') <= COLS), 'a row is wider than the terminal');
  assert.deepEqual(t.stdin.raw, [true]);

  t.stdin.write('\x1b[C'); // right
  await until(() => has(t, '── Phones'), 'the Devices tab');

  t.stdin.write('6');
  await until(() => has(t, '▶ js'), 'the Errors tab with the first entry selected');
  t.stdin.write('\x1b[B'); // down
  await until(() => has(t, '▶ native'), 'the second entry selected');
  t.stdin.write('\r');
  await until(() => has(t, 'Stack frames') && has(t, 'service not started'), 'the error detail');
  t.stdin.write('\x7f'); // backspace
  await until(() => has(t, '▶ native') && !has(t, 'Stack frames'), 'back to the list');

  t.stdin.write('7');
  t.stdin.write('\r');
  await until(() => has(t, 'Engine log tail') && has(t, 'worker exited with code 137'), 'the report detail');
  t.stdin.write('\x7f');

  t.stdin.write('w');
  await until(() => calls.length === 2, 'a reload for the next window');
  assert.deepEqual(calls[1], { days: 90, testers: false });
  await until(() => has(t, '90 days'), 'the new window in the header');

  t.stdin.write('t');
  await until(() => calls.length === 3, 'a reload with testers');
  assert.deepEqual(calls[2], { days: 90, testers: true });
  await until(() => has(t, 'testers shown'), 'the testers note in the header');

  t.stdin.write('?');
  await until(() => has(t, '── Keys'), 'the help');
  t.stdin.write('x');
  await until(() => !has(t, '── Keys'), 'the help closed');

  t.stdin.write('q');
  await done;
  assert.ok(t.output().endsWith('\x1b[0m\x1b[?25h\x1b[?1049l'), 'the terminal was not restored');
  assert.deepEqual(t.stdin.raw, [true, false]);
});

test('a failed load is shown, and r retries', async () => {
  const t = terminal();
  let fail = true;
  const load = async ({ days, testers }) => {
    if (fail) throw new Error('cf d1 query exited 1: not logged in');
    return buildModel({ results: sampleResults(), now: NOW, days, testers, source: 'cf CLI', database: 'db', rowsRead: 5 });
  };
  const done = runTui({ load, days: 7, testers: false, style: makeStyle(false), stdin: t.stdin, stdout: t.stdout });
  await until(() => has(t, 'Could not read the data: cf d1 query exited 1: not logged in'), 'the error');
  fail = false;
  t.stdin.write('r');
  await until(() => has(t, '5 rows read'), 'the retried load');
  t.stdin.write('\x03'); // ctrl-c
  await done;
});
