import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildModel } from '../model.mjs';
import { NOW, SHARE_CODE, sampleResults } from '../sample.test-support.mjs';
import { campaignsModel, spread } from './model.mjs';
import { NEW_TABLES } from './queries.mjs';

const model = (missing = []) => buildModel({ results: sampleResults(), now: NOW, days: 7, missing });

test('spread: all time, the window, and its days; day "" is before the window', () => {
  const days = ['2026-11-05', '2026-11-06'];
  assert.deepEqual(spread(days, [{ day: '', n: 5 }, { day: '2026-11-06', n: 2 }, { day: '2026-11-06', n: 1 }]), { all: 8, window: 3, daily: [0, 3] });
  assert.deepEqual(spread(days, []), { all: 0, window: 0, daily: [0, 0] });
});

test('share links: sent, opens, downloads and installs', () => {
  const s = model().share;
  assert.deepEqual(s.links, { sent: 40, sentNew: 6, sharers: 12 });
  assert.deepEqual([s.opens.all, s.opens.window], [230, 30]);
  assert.deepEqual([s.downloads.all, s.downloads.window], [70, 10]);
  assert.deepEqual([s.installs.all, s.installs.window], [18, 4]);
  assert.deepEqual(s.installs.daily, [0, 0, 0, 0, 0, 4, 0]);
  assert.equal(s.installs.using, 10);
});

test('share links: the top links and who brings in whom', () => {
  const s = model().share;
  assert.deepEqual(s.top[0], { code: SHARE_CODE, installs: 8, using: 4, opens: 70, downloads: 20 });
  assert.deepEqual(s.second, { came: 18, sharers: 3, installs: 4, perCame: 4 / 18 });
  assert.deepEqual(model(NEW_TABLES).share, s, 'the share links never wait on migration 0005');
});

test('campaigns: listed tags with no rows still show, a counted tag no longer listed too, most opened first', () => {
  const c = model().campaigns;
  assert.equal(c.ready, true);
  assert.deepEqual(
    c.tags.map((t) => [t.tag, t.listed, t.opens, t.downloads, t.lastDay]),
    [
      ['hn', true, 350, 35, '2026-11-05'],
      ['old-post', false, 4, 0, '2026-09-27'],
      ['reddit', true, 0, 0, null],
    ],
  );
  assert.equal(c.tags[0].note, 'Hacker News launch post');
  assert.deepEqual([c.opens.window, c.downloads.window], [50, 35]);
});

test('campaigns before migration 0005: nothing; an empty model is empty', () => {
  const c = model(NEW_TABLES).campaigns;
  assert.deepEqual([c.ready, c.listReady, c.tags], [false, false, []]);
  assert.deepEqual(campaignsModel({}, ['2026-11-06']).tags, []);
  assert.equal(buildModel({ results: {}, now: NOW, days: 7 }).campaigns.listReady, true);
});
