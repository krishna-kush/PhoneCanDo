import assert from 'node:assert/strict';
import { test } from 'node:test';
import { campaignListOf } from './campaign-list.mjs';

test('the campaigns rows as a list: tag, note and day added, in row order', () => {
  assert.deepEqual(
    campaignListOf([
      { tag: 'hn', note: 'Hacker News launch post', added: '2026-11-18' },
      { tag: 'x', note: null, added: '' },
      { note: 'no tag' },
      null,
    ]),
    [
      { tag: 'hn', note: 'Hacker News launch post', added: '2026-11-18' },
      { tag: 'x', note: '', added: null },
    ],
  );
});

test('no rows (or no statement, before migration 0005) is an empty list', () => {
  assert.deepEqual(campaignListOf([]), []);
  assert.deepEqual(campaignListOf(undefined), []);
});
