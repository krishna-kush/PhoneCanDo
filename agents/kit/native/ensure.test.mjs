// ensure.mjs: every question is asked, and the terminal let go, before any
// download or build starts (an open readline keeps Ctrl+C from stopping one).
//   node --test agents/kit/native/ensure.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { askAll } from './ensure.mjs';

// A readline stand-in: says what happened, in order.
function fakeRl(log) {
  return {
    on: () => {},
    question: async () => '',
    close: () => log.push('close'),
  };
}

const plan = (id, pick) => ({ kind: { id }, choice: { actions: [{}, {}], pick } });

test('asks every kind, then closes the terminal, before any work', async () => {
  const log = [];
  const askOne = async (_rl, kind, choice) => {
    log.push(`ask ${kind.id}`);
    return choice.pick;
  };
  const picks = await askAll(fakeRl(log), [plan('a', 1), plan('b', 0)], askOne);
  assert.deepEqual(picks, [1, 0]);
  assert.deepEqual(log, ['ask a', 'ask b', 'close']);
});

test('closes the terminal when a question fails', async () => {
  const log = [];
  const askOne = async () => {
    throw new Error('gone');
  };
  await assert.rejects(askAll(fakeRl(log), [plan('a', 0)], askOne), /gone/);
  assert.deepEqual(log, ['close']);
});

test('with no questions (--yes, or named ids) takes each default', async () => {
  assert.deepEqual(await askAll(null, [plan('a', 1), plan('b', 0)]), [1, 0]);
});
