import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildModel } from '../model.mjs';
import { makeStyle, stripAnsi, width } from '../paint.mjs';
import { renderReport } from '../report.mjs';
import { NOW, SHARE_CODE, sampleResults } from '../sample.test-support.mjs';
import { renderTab } from '../views.mjs';
import { NEW_TABLES } from './queries.mjs';

const plain = makeStyle(false);
const ready = buildModel({ results: sampleResults(), now: NOW, days: 30 });
const before = buildModel({ results: sampleResults(), now: NOW, days: 30, missing: NEW_TABLES });
const empty = buildModel({ results: {}, now: NOW, days: 7 });
const text = (id, m, opts = {}) => renderTab(id, m, { w: 120, style: plain, ...opts }).lines.join('\n');

test('both tabs fit every width, before and after migration 0005, coloured or not', () => {
  for (const style of [plain, makeStyle(true)]) {
    for (const w of [72, 100, 140]) {
      for (const m of [ready, before, empty]) {
        for (const id of ['share', 'campaigns']) {
          for (const report of [false, true]) {
            const wide = renderTab(id, m, { w, style, report }).lines.filter((l) => width(l) > w);
            assert.deepEqual(wide, [], `${id} at ${w}`);
          }
        }
      }
    }
  }
});

test('share links: installs, conversion and who brings in whom', () => {
  const t = text('share', ready);
  assert.match(t, /Installs/);
  assert.match(t, /Conversion/);
  assert.match(t, /26%/); // 18 installs of 70 downloads
  assert.match(t, /… that sent links themselves\s+3/);
  assert.match(t, /Installs through their links\s+4/);
  assert.match(t, /Installs per phone that came\s+0\.22/);
  assert.doesNotMatch(t, /nonymous|via|stamp/i);
});

test('share links: the codes show interactively, never in the build report', () => {
  assert.match(text('share', ready), new RegExp(SHARE_CODE));
  const report = text('share', ready, { report: true });
  assert.ok(!report.includes(SHARE_CODE));
  assert.match(report, /#1 /);
  assert.ok(!stripAnsi(renderReport(ready, { w: 110, style: plain })).includes(SHARE_CODE));
});

test('before migration 0005: the share links read as ever; campaign counts and the list say not set up yet', () => {
  assert.doesNotMatch(text('share', before), /not set up yet/);
  const campaigns = text('campaigns', before);
  assert.match(campaigns, /The list is not set up yet: campaigns is not on the database \(migration 0005\)/);
  assert.match(campaigns, /Counts not set up yet: campaign_daily is not on the database \(migration 0005\)/);
});

test('campaigns: counts, rate and last day per tag; listed tags never counted show too', () => {
  const t = text('campaigns', ready);
  assert.match(t, /hn\s+Hacker News launch post\s+2026-10-27\s+350\s+35\s+10%\s+2026-11-05/);
  assert.match(t, /reddit\s+r\/androiddev thread\s+2026-11-04\s+0\s+0\s+–\s+–/);
  assert.match(t, /old-post\s+\(no longer listed\)/);
  assert.match(t, /Opens\s+\S+\s+total 50/);
  assert.match(t, /the list: D1 table campaigns/);
  assert.match(t, /counts from then on, no push needed/);
});

test('no campaigns: says how to add one', () => {
  const t = text('campaigns', empty);
  assert.doesNotMatch(t, /not set up yet/);
  assert.match(t, /No campaigns yet: \.\/manage campaign add <tag> "<note>"/);
});
