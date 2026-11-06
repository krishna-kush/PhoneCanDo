import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildModel, histPercentile, installerName } from './model.mjs';
import { NOW, sampleAe, sampleResults } from './sample.test-support.mjs';

const model = () => buildModel({ results: sampleResults(), ae: sampleAe(), now: NOW, days: 7, source: 'cf CLI', database: 'phonecando-stats', rowsRead: 99 });

test('totals: events and errors are sums of their grouped rows', () => {
  const m = model();
  assert.equal(m.totals.devices, 42);
  assert.equal(m.totals.sessions, 100);
  assert.equal(m.totals.sessionDevices, 28);
  assert.equal(m.totals.events, 800);
  assert.equal(m.totals.errors, 8);
  assert.equal(m.meta.rowsRead, 99);
});

test('daily series cover every day of the window, zeros filled', () => {
  const m = model();
  assert.equal(m.daily.sessions.length, 7);
  assert.deepEqual(m.daily.sessions, [0, 0, 0, 0, 40, 0, 60]);
  assert.deepEqual(m.daily.errors, [0, 0, 0, 0, 0, 6, 2]);
  assert.deepEqual(m.site.views, [0, 0, 0, 0, 0, 40, 60]);
});

test('health sums and boot percentiles from the histogram', () => {
  const h = model().health;
  assert.deepEqual(h.engine, { ok: 97, known: 100 });
  assert.deepEqual(h.trimmed, { ok: 3, known: 100 });
  assert.equal(h.boot.count, 100);
  assert.equal(h.boot.p50, 2750);
  assert.equal(h.boot.p90, 9250);
  assert.equal(histPercentile([], 0.5), null);
});

test('installers read as people would say them', () => {
  assert.equal(installerName('com.android.vending'), 'Play Store');
  assert.equal(installerName(null), 'adb or unknown');
  assert.equal(installerName('org.fdroid.fdroid'), 'org.fdroid.fdroid');
  assert.deepEqual(model().installs.sources.map((s) => s.label), ['Package installer (APK)', 'adb or unknown', 'PhoneCanDo updater']);
});

test('reports parse the phone; errors parse their frames', () => {
  const m = model();
  assert.equal(m.reports[0].device.name, 'Google Pixel 9');
  assert.equal(m.reports[0].device.android, 'Android 16 (36)');
  assert.equal(m.reports[0].device.installer, 'PhoneCanDo updater');
  assert.equal(m.errors.keys[0].frames.length, 1);
  assert.deepEqual(m.errors.keys[1].frames, []);
});

test('GitHub: per-day increases of the counters, stars carried forward', () => {
  const g = model().github;
  assert.deepEqual(g.downloadsPerDay.slice(-2), [80, 60]);
  assert.deepEqual(g.checksPerDay.slice(-2), [70, 70]);
  assert.deepEqual(g.stars, [null, null, null, 10, 10, 10, 14]);
  assert.equal(g.latest.stars, 14);
});

test('Analytics Engine: bots apart from people', () => {
  const ae = model().ae;
  assert.equal(ae.available, true);
  assert.equal(ae.downloadBots, 6);
  assert.deepEqual(ae.downloadPeople, [
    { label: 'lite', value: 7 },
    { label: 'full', value: 3 },
  ]);
  assert.equal(buildModel({ results: {}, ae: { results: {}, problem: 'no token' }, now: NOW, days: 7 }).ae.note, 'no token');
});

test('an empty database is all zeros, never an exception', () => {
  const m = buildModel({ results: {}, now: NOW, days: 30 });
  assert.equal(m.totals.devices, 0);
  assert.equal(m.daily.devices.length, 30);
  assert.equal(m.github.latest, null);
  assert.equal(m.ae.available, false);
});
