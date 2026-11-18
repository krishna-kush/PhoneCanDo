// The D1 statements behind the Share links and Campaigns tabs of
// scripts/data.mjs: what the links people sent brought in (migration 0004's
// share tables), the campaign links' opens and downloads (0005's
// campaign_daily) and the campaigns we made (0005's campaigns, the list
// ./manage campaign add writes). Pure: options in, SQL out.
//
// Cost: these tables hold one row per link (or tag), step and day, or one
// per install: far fewer than sessions or events. Each is read in one pass,
// days before the window folded into one row (day '') so all-time totals
// come from the same rows. "Still using" finds each install's sessions
// through sessions_device; the top links' counts are primary-key lookups.

/** The migration that adds each new table; a database without one yet is read without it. */
export const NEW_TABLE_MIGRATION = { campaign_daily: '0005', campaigns: '0005' };
/** Tables newer than the rest of the batch, oldest first. */
export const NEW_TABLES = Object.keys(NEW_TABLE_MIGRATION);

/** The row's UTC day inside the window, or '' for any day before it (one row for all of them). */
const dayIn = (sinceDay, column = 'day') => `CASE WHEN ${column} >= '${sinceDay}' THEN ${column} ELSE '' END`;

/**
 * The install `i` is still in use: its phone had a session that started on
 * a later UTC day. The rule of the app's Tell a friend page
 * (tce/stores/sql/share.ts, installStats).
 */
const stillUsing = (i) =>
  `EXISTS (SELECT 1 FROM sessions s WHERE s.device_id = ${i}.device_id AND s.started >= (strftime('%s', ${i}.day) + 86400) * 1000)`;

/**
 * The share and campaign statements: [{ name, sql }]. `real` is the device
 * filter of queries.mjs; `missing` lists NEW_TABLES the database lacks, whose
 * statements are left out or read without them.
 */
export function linkStatements({ since, sinceDay, real, testers = false, missing = [] }) {
  // Rows keyed by code carry no device: leave out the codes our test phones own.
  const ours = testers ? '1 = 1' : 'code NOT IN (SELECT code FROM share_links WHERE device_id IN (SELECT device_id FROM devices WHERE tester = 1))';
  const statements = [
    {
      name: 'shareLinks',
      sql: `SELECT count(*) AS links, coalesce(sum(created >= ${since}), 0) AS links_new, count(DISTINCT device_id) AS sharers
FROM share_links WHERE ${real}`,
    },
    {
      name: 'shareDaily',
      sql: `SELECT ${dayIn(sinceDay)} AS day, step, sum(count) AS n FROM share_daily WHERE ${ours} GROUP BY 1, step`,
    },
    {
      // Installs (usage stats on, share.install): one row per phone.
      name: 'shareInstalls',
      sql: `SELECT ${dayIn(sinceDay, 'i.day')} AS day, count(*) AS n, coalesce(sum(${stillUsing('i')}), 0) AS still_using
FROM share_installs i WHERE ${real} AND ${ours} GROUP BY 1`,
    },
    {
      // Top 10 links by installs, then each one's counts.
      name: 'shareTop',
      sql: `WITH ranked AS (
  SELECT code, count(*) AS installs FROM share_installs WHERE ${real} AND ${ours}
  GROUP BY code ORDER BY installs DESC, code LIMIT 10
)
SELECT code, installs,
  (SELECT count(*) FROM share_installs i WHERE i.code = ranked.code AND ${real} AND ${stillUsing('i')}) AS still_using,
  (SELECT coalesce(sum(count), 0) FROM share_daily d WHERE d.code = ranked.code AND d.step = 'open') AS opens,
  (SELECT coalesce(sum(count), 0) FROM share_daily d WHERE d.code = ranked.code AND d.step = 'download') AS downloads
FROM ranked ORDER BY installs DESC, code`,
    },
    {
      // Who brings in whom: phones that came through a link, the ones among
      // them that sent links too, and the installs those links brought.
      name: 'shareSecond',
      sql: `WITH came AS (SELECT device_id FROM share_installs WHERE ${real} AND ${ours}),
  theirs AS (SELECT code FROM share_links WHERE device_id IN (SELECT device_id FROM came))
SELECT (SELECT count(*) FROM came) AS came,
  (SELECT count(DISTINCT device_id) FROM share_links WHERE device_id IN (SELECT device_id FROM came)) AS sharers,
  (SELECT count(*) FROM share_installs WHERE ${real} AND code IN (SELECT code FROM theirs)) AS installs`,
    },
  ];
  if (!missing.includes('campaign_daily')) {
    statements.push({
      // No identity, so no tester filter; counted for people only (no bots).
      name: 'campaignDaily',
      sql: `SELECT tag, step, ${dayIn(sinceDay)} AS day, sum(count) AS n, max(day) AS last_day FROM campaign_daily GROUP BY tag, step, 3`,
    });
  }
  if (!missing.includes('campaigns')) {
    // The campaigns we made (a handful of rows): the Worker counts only these tags.
    statements.push({ name: 'campaignList', sql: 'SELECT tag, note, added FROM campaigns ORDER BY added, tag' });
  }
  return statements;
}

/** Whether `sql` names `table` as a whole word (campaigns is not campaign_daily). */
const names = (sql, table) => new RegExp(`\\b${table}\\b`).test(sql);

/** The newest of NEW_TABLES that `sql` reads, as its index in NEW_TABLES; -1 for none. */
export function newestTableRead(sql) {
  return NEW_TABLES.reduce((newest, t, i) => (names(sql, t) ? i : newest), -1);
}
