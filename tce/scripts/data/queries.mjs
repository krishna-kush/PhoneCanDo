// The read-only statements behind scripts/data.mjs: one batch of D1 SELECTs per
// refresh and the optional Analytics Engine SQL. Pure: options in, SQL out.
//
// Cost: every refresh is one D1 batch; rows read count toward the free plan's
// 5M a day (the footer and the report print the total). Scans are shared where
// one GROUP BY can answer several questions (sessions: daily counts and engine
// health in one pass; events and errors: totals from the grouped rows), and
// event and error windows use their `received` index.

const DAY_MS = 86_400_000;
/** Windows offered by the interactive `w` key; any 1..365 works with --days. */
export const WINDOWS = [7, 30, 90];
/** Analytics Engine keeps about three months. */
export const AE_MAX_DAYS = 90;

export const isoDay = (t) => new Date(t).toISOString().slice(0, 10);

/** The window for `days` ending at `now`: since (epoch ms, start of the first UTC day) and the day list. */
export function windowOf(now, days) {
  const today = Date.parse(`${isoDay(now)}T00:00:00Z`);
  const since = today - (days - 1) * DAY_MS;
  const list = [];
  for (let t = since; t <= today; t += DAY_MS) list.push(isoDay(t));
  return { since, sinceDay: isoDay(since), today: isoDay(today), days: list };
}

/**
 * The D1 batch: [{ name, sql }]. `testers` keeps our own test phones in
 * (Settings → About, long press marks them); by default they are left out.
 */
export function d1Statements({ now, days, testers = false }) {
  const { since, sinceDay } = windowOf(now, days);
  // Rows keyed by device: everything but our test phones.
  const real = testers ? '1 = 1' : 'device_id NOT IN (SELECT device_id FROM devices WHERE tester = 1)';
  const dev = testers ? '1 = 1' : 'tester = 0';
  const active = `${dev} AND last_seen >= ${since}`;
  const day = (col) => `date(${col} / 1000, 'unixepoch')`;
  return [
    {
      name: 'totals',
      sql: `SELECT
  (SELECT count(*) FROM devices WHERE ${dev}) AS devices,
  (SELECT count(*) FROM devices WHERE ${active}) AS devices_active,
  (SELECT count(*) FROM devices WHERE ${dev} AND first_seen >= ${since}) AS devices_new,
  (SELECT count(*) FROM devices WHERE tester = 1) AS testers,
  (SELECT count(*) FROM installs WHERE ${real}) AS installs,
  (SELECT count(*) FROM installs WHERE ${real} AND first_seen >= ${since}) AS installs_new,
  (SELECT count(*) FROM reports WHERE ${real}) AS reports,
  (SELECT count(*) FROM reports WHERE ${real} AND received >= ${since}) AS reports_new`,
    },
    {
      // One pass over sessions: per-day counts and the engine and phone health sums.
      name: 'sessionsDaily',
      sql: `SELECT ${day('started')} AS day, count(*) AS sessions, count(DISTINCT device_id) AS devices,
  sum(engine_ok = 1) AS engine_ok, sum(engine_ok IS NOT NULL) AS engine_known,
  sum(a11y_on = 1) AS a11y_on, sum(a11y_on IS NOT NULL) AS a11y_known,
  sum(battery_opt_ignored = 1) AS battery_ok, sum(battery_opt_ignored IS NOT NULL) AS battery_known,
  sum(fg_service_ok = 1) AS fg_ok, sum(fg_service_ok IS NOT NULL) AS fg_known,
  sum(low_memory_trims > 0) AS trimmed, sum(coalesce(low_memory_trims, 0)) AS trims
FROM sessions WHERE started >= ${since} AND ${real} GROUP BY day ORDER BY day`,
    },
    {
      name: 'activeDevices',
      sql: `SELECT count(DISTINCT device_id) AS devices FROM sessions WHERE started >= ${since} AND ${real}`,
    },
    {
      // 500 ms buckets, capped at 30 s; percentiles come from the histogram.
      name: 'boot',
      sql: `SELECT min(boot_ms, 30000) / 500 * 500 AS bucket, count(*) AS n FROM sessions
WHERE started >= ${since} AND ${real} AND boot_ms IS NOT NULL GROUP BY bucket ORDER BY bucket`,
    },
    {
      name: 'exitCodes',
      sql: `SELECT engine_exit_code AS code, count(*) AS n, count(DISTINCT device_id) AS devices FROM sessions
WHERE started >= ${since} AND ${real} AND engine_exit_code IS NOT NULL GROUP BY code ORDER BY n DESC LIMIT 8`,
    },
    {
      name: 'eventsDaily',
      sql: `SELECT ${day('received')} AS day, count(*) AS n FROM events WHERE received >= ${since} AND ${real} GROUP BY day ORDER BY day`,
    },
    {
      // Every name (the vocabulary is small), so the total is their sum.
      name: 'eventNames',
      sql: `SELECT name, count(*) AS n, count(DISTINCT device_id) AS devices FROM events
WHERE received >= ${since} AND ${real} GROUP BY name ORDER BY n DESC`,
    },
    {
      name: 'errorsDaily',
      sql: `SELECT ${day('received')} AS day, kind, count(*) AS n, count(DISTINCT device_id) AS devices FROM errors
WHERE received >= ${since} AND ${real} GROUP BY day, kind ORDER BY day`,
    },
    {
      name: 'errorDevices',
      sql: `SELECT count(DISTINCT device_id) AS devices FROM errors WHERE received >= ${since} AND ${real}`,
    },
    {
      // error_key hashes kind + class + top frame + version, so those are one per key.
      name: 'errorKeys',
      sql: `SELECT error_key, min(kind) AS kind, min(class_name) AS class_name, min(version) AS version,
  substr(min(message), 1, 300) AS message, min(frames) AS frames,
  count(*) AS n, count(DISTINCT device_id) AS devices, min(received) AS first, max(received) AS last
FROM errors WHERE received >= ${since} AND ${real} GROUP BY error_key ORDER BY devices DESC, n DESC LIMIT 30`,
    },
    {
      name: 'reports',
      sql: `SELECT report_id, received, version, channel, substr(note, 1, 1000) AS note, json_array_length(events) AS events_n,
  substr(log_tail, -2000) AS log_tail, device
FROM reports WHERE ${real} ORDER BY received DESC LIMIT 25`,
    },
    { name: 'channels', sql: `SELECT channel, count(*) AS n FROM installs WHERE ${real} GROUP BY channel ORDER BY n DESC` },
    {
      name: 'sources',
      sql: `SELECT coalesce(install_source, '') AS source, count(*) AS n FROM installs WHERE ${real} GROUP BY source ORDER BY n DESC LIMIT 8`,
    },
    {
      name: 'versions',
      sql: `SELECT last_version AS version, channel, count(*) AS n FROM installs
WHERE ${real} AND last_seen >= ${since} GROUP BY version, channel ORDER BY n DESC LIMIT 12`,
    },
    {
      name: 'models',
      sql: `SELECT manufacturer, model, count(*) AS n FROM devices WHERE ${active} GROUP BY manufacturer, model ORDER BY n DESC LIMIT 10`,
    },
    { name: 'android', sql: `SELECT sdk_int, count(*) AS n FROM devices WHERE ${active} GROUP BY sdk_int ORDER BY sdk_int DESC` },
    { name: 'ram', sql: `SELECT ram_gb, count(*) AS n FROM devices WHERE ${active} GROUP BY ram_gb ORDER BY ram_gb` },
    { name: 'abis', sql: `SELECT abi, count(*) AS n FROM devices WHERE ${active} GROUP BY abi ORDER BY n DESC LIMIT 6` },
    {
      name: 'countries',
      sql: `SELECT coalesce(country, '') AS country, count(*) AS n FROM devices WHERE ${active} GROUP BY country ORDER BY n DESC LIMIT 10`,
    },
    { name: 'locales', sql: `SELECT locale, count(*) AS n FROM devices WHERE ${active} GROUP BY locale ORDER BY n DESC LIMIT 8` },
    {
      name: 'siteDaily',
      sql: `SELECT day, kind, sum(count) AS n FROM site_daily WHERE day >= '${sinceDay}' GROUP BY day, kind ORDER BY day`,
    },
    {
      name: 'sitePaths',
      sql: `SELECT key AS path, sum(count) AS n FROM site_daily WHERE kind = 'view' AND day >= '${sinceDay}' GROUP BY key ORDER BY n DESC LIMIT 10`,
    },
    {
      name: 'siteCountries',
      sql: `SELECT country, kind, sum(count) AS n FROM site_daily WHERE day >= '${sinceDay}' GROUP BY country, kind ORDER BY n DESC LIMIT 30`,
    },
    {
      name: 'siteChannels',
      sql: `SELECT key AS channel, sum(count) AS n FROM site_daily WHERE kind = 'download' AND day >= '${sinceDay}' GROUP BY key ORDER BY n DESC`,
    },
    {
      name: 'siteTotals',
      sql: `SELECT kind, CASE WHEN kind = 'download' THEN key ELSE '' END AS what, sum(count) AS n, min(day) AS first_day
FROM site_daily GROUP BY kind, what ORDER BY kind DESC, what`,
    },
    {
      name: 'githubAssets',
      sql: `SELECT day, tag, asset, download_count FROM github_assets_daily
WHERE day = (SELECT max(day) FROM github_assets_daily) ORDER BY download_count DESC LIMIT 20`,
    },
    {
      name: 'githubDaily',
      sql: `SELECT day, sum(download_count) AS total, sum(CASE WHEN asset = 'latest.json' THEN download_count ELSE 0 END) AS checks
FROM github_assets_daily WHERE day >= '${isoDay(since - DAY_MS)}' GROUP BY day ORDER BY day`,
    },
    {
      name: 'githubRepo',
      sql: `SELECT day, stars, forks, watchers, views, view_uniques, clones, clone_uniques FROM github_repo_daily
WHERE day >= '${sinceDay}' OR day = (SELECT max(day) FROM github_repo_daily) ORDER BY day`,
    },
  ];
}

/**
 * Analytics Engine detail (needs a token with Account Analytics: Read):
 * [{ name, sql }], sample-weighted. Column order is
 * tce/stores/cloudflare/analytics.ts.
 */
export function aeStatements({ days, pageviews = 'phonecando_pageviews', downloads = 'phonecando_downloads' }) {
  const recent = `timestamp > NOW() - INTERVAL '${Math.min(days, AE_MAX_DAYS)}' DAY`;
  const n = 'SUM(_sample_interval * double1)';
  return [
    { name: 'viewClients', sql: `SELECT blob4 AS client, ${n} AS n FROM ${pageviews} WHERE ${recent} GROUP BY client ORDER BY n DESC` },
    {
      name: 'viewReferrers',
      sql: `SELECT blob2 AS ref, ${n} AS n FROM ${pageviews} WHERE ${recent} AND blob2 != '' AND blob4 != 'bot' GROUP BY ref ORDER BY n DESC LIMIT 10`,
    },
    {
      name: 'downloadClients',
      sql: `SELECT blob1 AS channel, blob6 AS client, ${n} AS n FROM ${downloads} WHERE ${recent} GROUP BY channel, client ORDER BY n DESC`,
    },
    {
      name: 'downloadAndroid',
      sql: `SELECT blob4 AS android, ${n} AS n FROM ${downloads} WHERE ${recent} AND blob6 != 'bot' GROUP BY android ORDER BY n DESC LIMIT 8`,
    },
    {
      name: 'downloadReferrers',
      sql: `SELECT blob5 AS ref, ${n} AS n FROM ${downloads} WHERE ${recent} AND blob5 != '' AND blob6 != 'bot' GROUP BY ref ORDER BY n DESC LIMIT 8`,
    },
  ];
}

/** Throws unless every statement is a single read-only SELECT. */
export function assertReadOnly(statements) {
  for (const { name, sql } of statements) {
    if (!/^\s*(select|with)\b/i.test(sql) || sql.includes(';')) throw new Error(`refusing statement "${name}": only single SELECTs run`);
  }
}
