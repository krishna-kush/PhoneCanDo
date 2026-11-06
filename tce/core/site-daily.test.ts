import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { downloadPoint, pagePoint } from '../testkit/fixtures.ts';
import type { SiteDailyRow } from './schema/rows.ts';
import { compareSiteDaily, downloadRollup, pageViewRollup } from './site-daily.ts';

describe('site_daily rollup rule', () => {
  it('counts a view under its path and a download under its channel, country "" when unknown', () => {
    assert.deepEqual(pageViewRollup(pagePoint({ day: '2026-11-03', path: '/install', country: 'DE' })), {
      day: '2026-11-03',
      kind: 'view',
      key: '/install',
      country: 'DE',
      count: 1,
    });
    assert.equal(pageViewRollup(pagePoint({ country: null })).country, '');
    assert.deepEqual(downloadRollup(downloadPoint({ day: '2026-11-04', channel: 'full', country: null })), {
      day: '2026-11-04',
      kind: 'download',
      key: 'full',
      country: '',
      count: 1,
    });
  });

  it('orders rows by day, then kind, key and country', () => {
    const row = (day: string, kind: SiteDailyRow['kind'], key: string, country: string): SiteDailyRow => ({ day, kind, key, country, count: 1 });
    const rows = [
      row('2026-11-02', 'view', '/', ''),
      row('2026-11-01', 'view', '/b', 'IN'),
      row('2026-11-01', 'view', '/b', ''),
      row('2026-11-01', 'view', '/a', 'US'),
      row('2026-11-01', 'download', 'lite', 'IN'),
    ];
    assert.deepEqual(
      [...rows].sort(compareSiteDaily).map((r) => [r.day, r.kind, r.key, r.country]),
      [
        ['2026-11-01', 'download', 'lite', 'IN'],
        ['2026-11-01', 'view', '/a', 'US'],
        ['2026-11-01', 'view', '/b', ''],
        ['2026-11-01', 'view', '/b', 'IN'],
        ['2026-11-02', 'view', '/', ''],
      ],
    );
    assert.equal(compareSiteDaily(rows[0]!, { ...rows[0]!, count: 9 }), 0, 'count is not part of the order');
  });
});
