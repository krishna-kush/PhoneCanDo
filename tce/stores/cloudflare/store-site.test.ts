// Site traffic and usage on the Cloudflare store over wrangler's local D1
// (local-d1.test-support.ts): each page or download point goes to its
// Analytics Engine dataset in the documented blob/index order (through a
// recording fake; AE has no local emulation) AND adds +1 to site_daily in D1;
// an AE failure never stops the rollup; usage() reads D1's size_after; the
// storage guard skips the rollup while it is blocked.

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { downloadPoint, pagePoint } from '../../testkit/fixtures.ts';
import { createStorageGuardState } from './guard.ts';
import { createCloudflareStore } from './store.ts';
import { DB, count, failingDataset, memoryLog, recordingDataset, reset } from './local-d1.test-support.ts';

const DAY = '2026-11-01';

/** site_daily rows straight from D1, in key order. */
async function rollup(): Promise<Record<string, unknown>[]> {
  return (await DB.prepare('SELECT * FROM site_daily ORDER BY day, kind, key, country').all<Record<string, unknown>>()).results;
}

beforeEach(reset);

describe('cloudflare: Analytics Engine points', () => {
  test('page and download points use the documented blob/index order', async () => {
    const PAGEVIEWS = recordingDataset();
    const DOWNLOADS = recordingDataset();
    const store = createCloudflareStore({ DB, PAGEVIEWS, DOWNLOADS }, memoryLog());
    await store.writePagePoint(pagePoint({ day: DAY, path: '/install', refHost: 'www.google.com', country: 'IN', uaClass: 'android' }));
    await store.writePagePoint(pagePoint({ day: DAY, path: '/', refHost: null, country: null, uaClass: 'bot' }));
    await store.writeDownloadPoint(downloadPoint({ day: DAY, channel: 'full', version: '0.1.2', country: 'DE', androidMajor: 16, refHost: 'github.com' }));
    await store.writeDownloadPoint(downloadPoint({ day: DAY, channel: 'lite', country: null, androidMajor: null, refHost: null, uaClass: 'desktop' }));
    assert.deepEqual(PAGEVIEWS.points, [
      { blobs: ['/install', 'www.google.com', 'IN', 'android'], doubles: [1], indexes: ['IN'] },
      { blobs: ['/', '', '', 'bot'], doubles: [1], indexes: ['XX'] },
    ]);
    assert.deepEqual(DOWNLOADS.points, [
      { blobs: ['full', '0.1.2', 'DE', '16', 'github.com', 'android'], doubles: [1], indexes: ['full'] },
      { blobs: ['lite', '0.1.2', '', '', '', 'desktop'], doubles: [1], indexes: ['lite'] },
    ]);
  });

  test('a missing dataset drops only its own AE points; the rollup counts every point', async () => {
    const DOWNLOADS = recordingDataset();
    const partial = createCloudflareStore({ DB, DOWNLOADS }, memoryLog());
    assert.deepEqual(await partial.writePagePoint(pagePoint({ day: DAY })), { ok: true, value: undefined });
    assert.deepEqual(await partial.writeDownloadPoint(downloadPoint({ day: DAY })), { ok: true, value: undefined });
    assert.equal(DOWNLOADS.points.length, 1);
    const bare = createCloudflareStore({ DB }, memoryLog());
    assert.deepEqual(await bare.writePagePoint(pagePoint({ day: DAY })), { ok: true, value: undefined });
    assert.deepEqual(await rollup(), [
      { day: DAY, kind: 'download', key: 'lite', country: 'IN', count: 1 },
      { day: DAY, kind: 'view', key: '/', country: 'IN', count: 2 },
    ]);
  });

  test('a throwing writeDataPoint is logged and the rollup still lands (ok)', async () => {
    const log = memoryLog();
    const store = createCloudflareStore({ DB, PAGEVIEWS: failingDataset('too many blobs'), DOWNLOADS: failingDataset() }, log);
    assert.deepEqual(await store.writePagePoint(pagePoint({ day: DAY })), { ok: true, value: undefined });
    assert.deepEqual(await store.writeDownloadPoint(downloadPoint({ day: DAY })), { ok: true, value: undefined });
    assert.equal(await count('site_daily'), 2);
    assert.equal(log.errors.length, 2);
    assert.match(log.errors[0]!, /writePagePoint analytics sink failed; rollup still written .*too many blobs/);
  });
});

describe('cloudflare: site_daily on D1', () => {
  test('two page views and a download become counted rows; listSiteDaily reads the range back in key order', async () => {
    const store = createCloudflareStore({ DB, PAGEVIEWS: recordingDataset(), DOWNLOADS: recordingDataset() }, memoryLog());
    await store.writePagePoint(pagePoint({ day: DAY, path: '/' }));
    await store.writePagePoint(pagePoint({ day: DAY, path: '/' }));
    await store.writePagePoint(pagePoint({ day: DAY, path: '/', country: null }));
    await store.writeDownloadPoint(downloadPoint({ day: DAY, channel: 'lite' }));
    await store.writeDownloadPoint(downloadPoint({ day: '2026-11-02', channel: 'full' }));
    const expected = [
      { day: DAY, kind: 'download', key: 'lite', country: 'IN', count: 1 },
      { day: DAY, kind: 'view', key: '/', country: '', count: 1 },
      { day: DAY, kind: 'view', key: '/', country: 'IN', count: 2 },
      { day: '2026-11-02', kind: 'download', key: 'full', country: 'IN', count: 1 },
    ];
    assert.deepEqual(await rollup(), expected);
    assert.deepEqual(await store.listSiteDaily(DAY, '2026-11-02'), { ok: true, value: expected });
    assert.deepEqual(await store.listSiteDaily(DAY, DAY), { ok: true, value: expected.slice(0, 3) });
    assert.deepEqual(await store.listSiteDaily('2026-11-03', '2026-12-31'), { ok: true, value: [] });
    const bad = await store.listSiteDaily('20261101', DAY);
    assert.equal(!bad.ok && bad.error.code, 'bad_request');
  });
});

describe('cloudflare: usage on D1', () => {
  test('dbBytes is D1’s size_after (a number), the guard learns it, ingest is not paused', async () => {
    const state = createStorageGuardState();
    const store = createCloudflareStore({ DB }, memoryLog(), { guardState: state });
    const r = await store.usage();
    assert.ok(r.ok);
    assert.equal(r.value.ingestPaused, false);
    assert.equal(typeof r.value.dbBytes, 'number');
    assert.ok(r.value.dbBytes! > 0 && r.value.dbBytes! < 100_000_000, String(r.value.dbBytes));
    assert.equal(state.sizeBytes, r.value.dbBytes);
  });

  test('over the guard limit, usage reports ingestPaused and the rollup is skipped; reads and usage keep working', async () => {
    const log = memoryLog();
    const PAGEVIEWS = recordingDataset();
    const store = createCloudflareStore({ DB, PAGEVIEWS }, log, { guardState: createStorageGuardState(), storageLimitBytes: 1 });
    const u = await store.usage();
    assert.ok(u.ok);
    assert.equal(u.value.ingestPaused, true, 'the probe’s size_after starts the block window');
    assert.equal(typeof u.value.dbBytes, 'number');
    assert.deepEqual(await store.writePagePoint(pagePoint({ day: DAY })), { ok: true, value: undefined });
    assert.equal(await count('site_daily'), 0, 'nothing reached D1');
    assert.equal(PAGEVIEWS.points.length, 1, 'the AE point still went out');
    assert.deepEqual(log.warnings, ['tce sql store: writePagePoint rollup skipped; storage is nearly full']);
    assert.deepEqual(await store.listSiteDaily(DAY, DAY), { ok: true, value: [] });
    const again = await store.usage();
    assert.equal(again.ok && again.value.ingestPaused, true);
  });
});
