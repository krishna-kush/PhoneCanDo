// The shared SQL store's point writes: each point reaches the analytics sink
// unchanged AND adds +1 to the permanent site_daily rollup; a missing or
// failing sink never stops the rollup; listSiteDaily reads an inclusive day
// range in key order.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { DownloadPoint, PagePoint } from '../../core/schema/rows.ts';
import { downloadPoint, pagePoint } from '../../testkit/fixtures.ts';
import { count, freshDatabasePerTest, h, log, rec, store } from './store.test-support.ts';

freshDatabasePerTest();

const DAY = '2026-11-01';
const page = (over: Partial<PagePoint> = {}): PagePoint => pagePoint({ day: DAY, ...over });
const download = (over: Partial<DownloadPoint> = {}): DownloadPoint => downloadPoint({ day: DAY, ...over });

/** Every site_daily row in key order, as plain objects. */
function rollup(): Record<string, unknown>[] {
  return h.db.prepare('SELECT * FROM site_daily ORDER BY day, kind, key, country').all().map((r) => ({ ...r }));
}

describe('points: analytics sink', () => {
  test('points reach the sink unchanged', async () => {
    const pages: PagePoint[] = [];
    const downloads: DownloadPoint[] = [];
    const s = store({ points: { page: (p) => pages.push(p), download: (p) => downloads.push(p) } });
    await s.writePagePoint(page({ path: '/install' }));
    await s.writeDownloadPoint(download({ channel: 'full' }));
    assert.deepEqual(pages, [page({ path: '/install' })]);
    assert.deepEqual(downloads, [download({ channel: 'full' })]);
  });

  test('without a points sink, point writes still bump the rollup', async () => {
    const s = store();
    assert.deepEqual(await s.writePagePoint(page()), { ok: true, value: undefined });
    assert.deepEqual(await s.writeDownloadPoint(download()), { ok: true, value: undefined });
    assert.equal(rec.batches.length, 2);
    assert.equal(count(h.db, 'site_daily'), 2);
  });

  test('a throwing sink is logged and the rollup is still written (the write answers ok)', async () => {
    const s = store({
      points: {
        page() {
          throw new Error('AE down');
        },
        download() {
          throw new Error('AE down');
        },
      },
    });
    assert.deepEqual(await s.writePagePoint(page()), { ok: true, value: undefined });
    assert.deepEqual(await s.writeDownloadPoint(download()), { ok: true, value: undefined });
    assert.deepEqual(
      rollup().map((r) => [r['kind'], r['count']]),
      [
        ['download', 1],
        ['view', 1],
      ],
    );
    const errors = log.entries.filter((e) => e.level === 'error');
    assert.equal(errors.length, 2);
    assert.match(errors[0]!.message, /writePagePoint analytics sink failed; rollup still written/);
    assert.match(String(errors[0]!.data?.error), /AE down/);
  });
});

describe('points: site_daily rollup', () => {
  test('one upsert per point keyed (day, kind, key, country); repeats add up; null country is ""', async () => {
    const s = store();
    await s.writePagePoint(page({ path: '/' }));
    await s.writePagePoint(page({ path: '/' }));
    await s.writePagePoint(page({ path: '/', country: null }));
    await s.writePagePoint(page({ path: '/install', country: 'DE' }));
    await s.writePagePoint(page({ path: '/', day: '2026-11-02' }));
    await s.writeDownloadPoint(download({ channel: 'lite' }));
    await s.writeDownloadPoint(download({ channel: 'lite' }));
    await s.writeDownloadPoint(download({ channel: 'full', country: null }));
    assert.deepEqual(rollup(), [
      { day: DAY, kind: 'download', key: 'full', country: '', count: 1 },
      { day: DAY, kind: 'download', key: 'lite', country: 'IN', count: 2 },
      { day: DAY, kind: 'view', key: '/', country: '', count: 1 },
      { day: DAY, kind: 'view', key: '/', country: 'IN', count: 2 },
      { day: DAY, kind: 'view', key: '/install', country: 'DE', count: 1 },
      { day: '2026-11-02', kind: 'view', key: '/', country: 'IN', count: 1 },
    ]);
    assert.equal(rec.batches.length, 8, 'one driver batch per point');
    for (const b of rec.batches) {
      assert.equal(b.length, 1);
      assert.match(b[0]!.sql, /^INSERT INTO site_daily \(day, kind, key, country, count\) VALUES \(\?, \?, \?, \?, \?\) ON CONFLICT \(day, kind, key, country\) DO UPDATE SET count = site_daily\.count \+ excluded\.count$/);
    }
  });

  test('a point whose day is not YYYY-MM-DD is bad_request and writes nothing', async () => {
    const pages: PagePoint[] = [];
    const s = store({ points: { page: (p) => pages.push(p), download() {} } });
    for (const day of ['2026-11-1', '', 'yesterday', undefined as unknown as string]) {
      const r = await s.writePagePoint(page({ day }));
      assert.equal(!r.ok && r.error.code, 'bad_request', String(day));
    }
    assert.equal(count(h.db, 'site_daily'), 0);
    assert.equal(rec.batches.length, 0);
    assert.equal(pages.length, 4, 'the analytics sink still got the points');
  });
});

describe('listSiteDaily', () => {
  test('returns the rows of [fromDay, toDay] inclusive, in key order, exactly shaped', async () => {
    const s = store();
    for (const day of ['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']) {
      await s.writeDownloadPoint(download({ day, channel: 'lite' }));
      await s.writePagePoint(page({ day, path: '/b' }));
      await s.writePagePoint(page({ day, path: '/a' }));
    }
    await s.writePagePoint(page({ day: '2026-11-02', path: '/a' }));
    const r = await s.listSiteDaily('2026-11-01', '2026-11-02');
    assert.deepEqual(r, {
      ok: true,
      value: [
        { day: '2026-11-01', kind: 'download', key: 'lite', country: 'IN', count: 1 },
        { day: '2026-11-01', kind: 'view', key: '/a', country: 'IN', count: 1 },
        { day: '2026-11-01', kind: 'view', key: '/b', country: 'IN', count: 1 },
        { day: '2026-11-02', kind: 'download', key: 'lite', country: 'IN', count: 1 },
        { day: '2026-11-02', kind: 'view', key: '/a', country: 'IN', count: 2 },
        { day: '2026-11-02', kind: 'view', key: '/b', country: 'IN', count: 1 },
      ],
    });
    const oneDay = await s.listSiteDaily('2026-11-03', '2026-11-03');
    assert.equal(oneDay.ok && oneDay.value.length, 3, 'from = to is one day');
    assert.deepEqual(await s.listSiteDaily('2026-11-02', '2026-11-01'), { ok: true, value: [] }, 'an empty range');
    assert.deepEqual(await s.listSiteDaily('2027-01-01', '2027-12-31'), { ok: true, value: [] });
  });

  test('a bound that is not YYYY-MM-DD is bad_request without a query', async () => {
    const s = store();
    const from = await s.listSiteDaily('2026-11', '2026-11-30');
    assert.deepEqual(from, { ok: false, error: { code: 'bad_request', message: 'fromDay must be YYYY-MM-DD', field: 'fromDay' } });
    const to = await s.listSiteDaily('2026-11-01', null as unknown as string);
    assert.equal(!to.ok && to.error.field, 'toDay');
    assert.equal(rec.reads.length, 0);
  });
});
