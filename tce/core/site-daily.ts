// The site_daily rollup rule (SiteDailyRow in schema/rows.ts) in one place,
// so every store counts a point under the same key: key = path for a view,
// channel for a download; country '' when the edge did not know it.

import type { DownloadPoint, PagePoint, SiteDailyRow } from './schema/rows.ts';

/** The +1 a page view adds to site_daily. */
export function pageViewRollup(point: PagePoint): SiteDailyRow {
  return { day: point.day, kind: 'view', key: point.path, country: point.country ?? '', count: 1 };
}

/** The +1 a download adds to site_daily. */
export function downloadRollup(point: DownloadPoint): SiteDailyRow {
  return { day: point.day, kind: 'download', key: point.channel, country: point.country ?? '', count: 1 };
}

/** Orders site_daily rows by day, kind, key, country (listSiteDaily's order). */
export function compareSiteDaily(a: SiteDailyRow, b: SiteDailyRow): number {
  for (const col of ['day', 'kind', 'key', 'country'] as const) {
    if (a[col] < b[col]) return -1;
    if (a[col] > b[col]) return 1;
  }
  return 0;
}
