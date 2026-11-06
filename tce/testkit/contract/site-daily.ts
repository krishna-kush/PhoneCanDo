// Contract cases for the permanent site_daily rollup behind writePagePoint and
// writeDownloadPoint: +1 per point on (day, kind, key, country), country ''
// when unknown, listSiteDaily's inclusive range and order, no identity (forget
// and retention never touch it), and, when make() can fail the analytics
// sink, a rollup that survives the failure.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TceResult } from '../../core/result.ts';
import type { SiteDailyRow } from '../../core/schema/rows.ts';
import type { Store } from '../../core/store.ts';
import { DEVICE_ID, DEVICE_VERIFIER, T0, batchWrite, downloadPoint, pagePoint } from '../fixtures.ts';
import type { Make, StoreContractOptions } from './harness.ts';
import { apply, expectEmpty, expectRows, plain, using, value } from './harness.ts';

/** A site_daily row; count 1 unless given. */
function daily(day: string, kind: SiteDailyRow['kind'], key: string, country: string, count = 1): SiteDailyRow {
  return { day, kind, key, country, count };
}

/** listSiteDaily that must succeed, as plain rows (by default every day the cases use). */
async function listed(store: Store, fromDay = '2000-01-01', toDay = '2999-12-31'): Promise<Record<string, unknown>[]> {
  return value(await store.listSiteDaily(fromDay, toDay), `listSiteDaily(${fromDay}, ${toDay})`).map(plain);
}

/** writePagePoint / writeDownloadPoint that must succeed. */
async function view(store: Store, over: Parameters<typeof pagePoint>[0] = {}): Promise<void> {
  value(await store.writePagePoint(pagePoint(over)), 'writePagePoint');
}
async function download(store: Store, over: Parameters<typeof downloadPoint>[0] = {}): Promise<void> {
  value(await store.writeDownloadPoint(downloadPoint(over)), 'writeDownloadPoint');
}

/** Register the `site_daily rollup` cases. */
export function siteDailyCases(make: Make, opts: StoreContractOptions): void {
  describe('site_daily rollup', () => {
    it(
      'adds 1 per point to the row of its day, kind, key and country, for both point kinds',
      using(make, async (s) => {
        for (let i = 0; i < 3; i++) await view(s.store, { path: '/install' });
        await download(s.store);
        await download(s.store);
        const rows = [daily('2026-11-01', 'download', 'lite', 'IN', 2), daily('2026-11-01', 'view', '/install', 'IN', 3)];
        assert.deepEqual(await listed(s.store), rows);
        await expectRows(s, 'site_daily', rows);
        await expectEmpty(s, ['site_daily']);
      }),
    );

    it(
      'a download written with { rollup: false } adds nothing to site_daily (the download op: not a person)',
      using(make, async (s) => {
        value(await s.store.writeDownloadPoint(downloadPoint({ uaClass: 'bot' }), { rollup: false }), 'writeDownloadPoint (no rollup)');
        assert.deepEqual(await listed(s.store), []);
        await download(s.store);
        assert.deepEqual(await listed(s.store), [daily('2026-11-01', 'download', 'lite', 'IN')]);
        await expectEmpty(s, ['site_daily']);
      }),
    );

    it(
      'keeps a separate row per day, kind, key and country; other point fields never split a row',
      using(make, async (s) => {
        await view(s.store, { day: '2026-11-01', path: '/' });
        await view(s.store, { day: '2026-11-02', path: '/' });
        await view(s.store, { day: '2026-11-01', path: '/faq' });
        await view(s.store, { day: '2026-11-01', path: '/', country: 'US' });
        // The same key under the other kind is another row.
        await view(s.store, { day: '2026-11-01', path: 'lite' });
        await download(s.store, { day: '2026-11-01', channel: 'lite' });
        await download(s.store, { day: '2026-11-01', channel: 'full' });
        // Not part of the key: referrer, UA class, version, Android major.
        await view(s.store, { day: '2026-11-01', path: '/', refHost: 'news.ycombinator.com', uaClass: 'bot' });
        await download(s.store, { day: '2026-11-01', channel: 'lite', version: '0.2.0', androidMajor: null, refHost: 'github.com', uaClass: 'desktop' });
        assert.deepEqual(await listed(s.store), [
          daily('2026-11-01', 'download', 'full', 'IN'),
          daily('2026-11-01', 'download', 'lite', 'IN', 2),
          daily('2026-11-01', 'view', '/', 'IN', 2),
          daily('2026-11-01', 'view', '/', 'US'),
          daily('2026-11-01', 'view', '/faq', 'IN'),
          daily('2026-11-01', 'view', 'lite', 'IN'),
          daily('2026-11-02', 'view', '/', 'IN'),
        ]);
      }),
    );

    it(
      "counts an unknown country under '', apart from known ones",
      using(make, async (s) => {
        await view(s.store, { country: null });
        await view(s.store, { country: null });
        await view(s.store, { country: 'IN' });
        await download(s.store, { country: null });
        assert.deepEqual(await listed(s.store), [
          daily('2026-11-01', 'download', 'lite', ''),
          daily('2026-11-01', 'view', '/', '', 2),
          daily('2026-11-01', 'view', '/', 'IN'),
        ]);
      }),
    );

    it(
      'listSiteDaily returns the inclusive day range, ordered by day, kind, key, country',
      using(make, async (s) => {
        assert.deepEqual(await listed(s.store), [], 'an empty store');
        // Written out of order, so the order must come from the store.
        await view(s.store, { day: '2026-11-03', path: '/' });
        await view(s.store, { day: '2026-11-02', path: '/z', country: 'US' });
        await download(s.store, { day: '2026-11-02', channel: 'full' });
        await view(s.store, { day: '2026-11-01', path: '/' });
        await view(s.store, { day: '2026-10-31', path: '/' });
        await view(s.store, { day: '2026-11-02', path: '/a', country: 'US' });
        await view(s.store, { day: '2026-11-02', path: '/a', country: 'DE' });
        assert.deepEqual(await listed(s.store, '2026-11-01', '2026-11-02'), [
          daily('2026-11-01', 'view', '/', 'IN'),
          daily('2026-11-02', 'download', 'full', 'IN'),
          daily('2026-11-02', 'view', '/a', 'DE'),
          daily('2026-11-02', 'view', '/a', 'US'),
          daily('2026-11-02', 'view', '/z', 'US'),
        ]);
        assert.deepEqual(await listed(s.store, '2026-11-03', '2026-11-03'), [daily('2026-11-03', 'view', '/', 'IN')], 'one day');
        assert.deepEqual(await listed(s.store, '2026-11-04', '2026-12-31'), [], 'after every row');
        assert.deepEqual(await listed(s.store, '2026-11-02', '2026-11-01'), [], 'from after to');
        assert.equal((await listed(s.store)).length, 7);
      }),
    );

    it(
      'holds no identity: forget and report retention leave it alone',
      using(make, async (s) => {
        await view(s.store);
        await download(s.store);
        const before = await listed(s.store);
        await apply(s.store, batchWrite());
        value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget');
        value(await s.store.deleteExpiredReports(T0 + 1), 'deleteExpiredReports');
        assert.deepEqual(await listed(s.store), before);
      }),
    );

    it(
      'still counts a point when the analytics sink fails',
      { skip: opts.pointSinkFailure ? false : 'make() cannot fail the analytics sink' },
      using(
        () => make({ failingPointSink: true }),
        async (s) => {
          // Whether the call answers ok or reports the sink failure is the store's
          // choice; it must not throw, and the rollup must be written either way.
          for (const write of [() => s.store.writePagePoint(pagePoint()), () => s.store.writeDownloadPoint(downloadPoint())]) {
            let r: TceResult<void>;
            try {
              r = await write();
            } catch (e) {
              assert.fail(`a point write threw instead of returning a TceResult: ${String(e)}`);
            }
            assert.equal(typeof r.ok, 'boolean');
          }
          assert.deepEqual(await listed(s.store), [daily('2026-11-01', 'download', 'lite', 'IN'), daily('2026-11-01', 'view', '/', 'IN')]);
        },
      ),
    );
  });
}
