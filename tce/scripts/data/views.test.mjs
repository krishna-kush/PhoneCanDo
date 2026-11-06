import assert from 'node:assert/strict';
import { test } from 'node:test';
import { errorDetail, helpLines, reportDetail } from './detail.mjs';
import { buildModel } from './model.mjs';
import { makeStyle, stripAnsi, width } from './paint.mjs';
import { renderReport } from './report.mjs';
import { FRAME, LOG, NOTE, NOW, sampleAe, sampleResults } from './sample.test-support.mjs';
import { TABS, bootRanges, renderTab } from './views.mjs';

const full = buildModel({ results: sampleResults(), ae: sampleAe(), now: NOW, days: 30, source: 'API token', database: 'phonecando-stats', rowsRead: 1234 });
const empty = buildModel({ results: {}, ae: null, now: NOW, days: 7, source: 'cf CLI', database: 'phonecando-stats' });

for (const style of [makeStyle(false), makeStyle(true)]) {
  for (const w of [72, 100, 140]) {
    test(`every tab fits ${w} columns (${style.enabled ? 'colour' : 'plain'})`, () => {
      for (const m of [full, empty]) {
        for (const tab of TABS) {
          for (const report of [false, true]) {
            const { lines } = renderTab(tab.id, m, { w, style, report, selected: 0 });
            const wide = lines.filter((l) => width(l) > w);
            assert.deepEqual(wide, [], `${tab.id} (${report ? 'report' : 'interactive'}) has lines over ${w}`);
          }
        }
      }
      for (const lines of [errorDetail(full.errors.keys[0], { w, style, now: NOW }), reportDetail(full.reports[0], { w, style, now: NOW }), helpLines({ w, style })]) {
        assert.deepEqual(lines.filter((l) => width(l) > w), []);
      }
    });
  }
}

test('the report shows aggregates only: no note, log or stack frame', () => {
  const text = stripAnsi(renderReport(full, { w: 110, style: makeStyle(false) }));
  for (const secret of [NOTE, FRAME, ...LOG.split('\n')]) assert.ok(!text.includes(secret), `report leaks: ${secret}`);
  assert.ok(!text.includes('12 events · Google Pixel 9'), 'report rows name the phone');
  assert.match(text, /TCE usage data/);
  assert.match(text, /1,234 rows read/);
  assert.match(text, /Notes and logs stay out of build logs/);
  for (const tab of TABS) assert.match(text, new RegExp(`▌ ${tab.title.toUpperCase()}`));
});

test('the interactive lists and details do show them', () => {
  const style = makeStyle(false);
  const reports = renderTab('reports', full, { w: 120, style, selected: 0 });
  assert.ok(reports.lines.some((l) => l.includes(NOTE)));
  assert.ok(reportDetail(full.reports[0], { w: 120, style, now: NOW }).some((l) => l.includes('worker exited with code 137')));
  assert.ok(errorDetail(full.errors.keys[0], { w: 120, style, now: NOW }).some((l) => l.includes('ChatWebScreen.tsx')));
});

test('list items point at their first line, and the selection is marked', () => {
  const style = makeStyle(false);
  const { lines, items } = renderTab('errors', full, { w: 120, style, selected: 1 });
  assert.equal(items.length, 2);
  assert.match(lines[items[0]], /TypeError/);
  assert.match(lines[items[1]], /▶ native/);
  assert.doesNotMatch(lines[items[0]], /▶/);
});

test('boot ranges: whole seconds, then 10–20 s and 20 s or more, trailing empty ranges dropped', () => {
  const ranges = bootRanges([
    { bucket: 1500, n: 3 },
    { bucket: 2500, n: 5 },
  ]);
  assert.deepEqual(ranges.map((r) => r.label), ['0–1 s', '1–2 s', '2–3 s']);
  assert.deepEqual(ranges.map((r) => r.value), [0, 3, 5]);
  assert.equal(bootRanges([{ bucket: 30000, n: 1 }]).pop().label, '20 s or more');
});

test('testers: the overview says how many are left out', () => {
  const lines = renderTab('overview', full, { w: 120, style: makeStyle(false) }).lines;
  assert.ok(lines.some((l) => /2 tester devices left out/.test(l)));
});
