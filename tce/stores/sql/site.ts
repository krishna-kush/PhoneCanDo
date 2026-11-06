// site_daily, the permanent rollup of site traffic (migration 0003): the row a
// page or download point adds, and the range read. Pure: no driver calls here;
// createSqlStore runs what this builds.

import { err, ok } from '../../core/result.ts';
import type { TceResult } from '../../core/result.ts';
import type { DownloadPoint, PagePoint, SiteDailyRow } from '../../core/schema/rows.ts';
import { buildInserts } from './chunk.ts';
import type { SqlStatement } from './driver.ts';
import { SITE_DAILY } from './tables.ts';

/** A UTC day as the rollup keys it. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** listSiteDaily's query: one primary-key range scan, in key order. */
export const LIST_SITE_DAILY =
  `SELECT ${SITE_DAILY.columns.join(', ')} FROM site_daily WHERE day >= ? AND day <= ? ORDER BY day, kind, key, country`;

/** The +1 a page view adds: (day, 'view', path, country or ''). */
export function pageRollup(p: PagePoint): SiteDailyRow {
  return { day: p.day, kind: 'view', key: p.path, country: p.country ?? '', count: 1 };
}

/** The +1 a download adds: (day, 'download', channel, country or ''). */
export function downloadRollup(p: DownloadPoint): SiteDailyRow {
  return { day: p.day, kind: 'download', key: p.channel, country: p.country ?? '', count: 1 };
}

/**
 * The upsert for one rollup row, or bad_request when the point's day is not a
 * YYYY-MM-DD string. Why check here: the column is NOT NULL TEXT, so a missing
 * or malformed day would otherwise fail in SQL (`unavailable`) or file the hit
 * under a key no range read finds.
 */
export function rollupStatement(row: SiteDailyRow): TceResult<SqlStatement> {
  if (typeof row.day !== 'string' || !DAY.test(row.day)) return err('bad_request', 'point day must be YYYY-MM-DD', 'day');
  const [stmt] = buildInserts(SITE_DAILY, [row]);
  return stmt ? ok(stmt) : err('internal', 'no statement built for a site_daily row');
}

/** bad_request unless `day` is a YYYY-MM-DD string (a listSiteDaily bound). */
export function dayBound(day: unknown, field: string): TceResult<string> {
  return typeof day === 'string' && DAY.test(day) ? ok(day) : err('bad_request', `${field} must be YYYY-MM-DD`, field);
}

/** A site_daily row read back, with exactly the row type's fields and a numeric count. */
export function siteDailyFrom(raw: Record<string, unknown>): SiteDailyRow {
  return {
    day: String(raw['day']),
    // Only this store writes the column, so it holds a SiteDailyRow kind.
    kind: String(raw['kind']) as SiteDailyRow['kind'],
    key: String(raw['key']),
    country: String(raw['country'] ?? ''),
    count: Number(raw['count']) || 0,
  };
}
