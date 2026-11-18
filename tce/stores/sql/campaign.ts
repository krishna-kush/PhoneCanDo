// Campaigns (migration 0005): the +1 of a campaign page's view or
// download, counted only for a tag in the campaigns table. Pure: no driver
// calls here; createSqlStore runs what this builds.

import { err, ok } from '../../core/result.ts';
import type { TceResult } from '../../core/result.ts';
import type { CampaignDailyRow } from '../../core/schema/rows.ts';
import { toSqlValue } from './chunk.ts';
import type { SqlStatement } from './driver.ts';
import { dayBound } from './site.ts';
import { CAMPAIGN_DAILY } from './tables.ts';

/**
 * The upsert for one campaign_daily row, or bad_request for a malformed day or
 * an unknown step. It adds nothing for a tag not in campaigns: the list is
 * read in the same statement, so a tag added with `./manage campaign add`
 * counts at once and a made-up one never lands.
 */
export function campaignStepStatement(row: CampaignDailyRow): TceResult<SqlStatement> {
  const day = dayBound(row.day, 'day');
  if (!day.ok) return day;
  if (row.step !== 'open' && row.step !== 'download') return err('bad_request', "step must be 'open' or 'download'", 'step');
  const cols = CAMPAIGN_DAILY.columns;
  return ok({
    sql:
      `INSERT INTO ${CAMPAIGN_DAILY.table} (${cols.join(', ')}) SELECT ${cols.map(() => '?').join(', ')} ` +
      // The WHERE also settles SQLite's INSERT ... SELECT ... ON CONFLICT parsing ambiguity.
      `WHERE EXISTS (SELECT 1 FROM campaigns WHERE tag = ?) ${CAMPAIGN_DAILY.onConflict}`,
    params: [...cols.map((c) => toSqlValue(row[c], c)), row.tag],
  });
}
