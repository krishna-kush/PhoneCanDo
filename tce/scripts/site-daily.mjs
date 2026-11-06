// site_daily summaries for scripts/stats.mjs --d1: the permanent daily rollup
// of site page views and /dl downloads (migration 0003; Analytics Engine keeps
// the detail only ~3 months). Pure: SQL in, text out.
import { formatTable } from './text-table.mjs';

const DAY_MS = 86_400_000;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);

/** The read-only statements and the 30-day window (UTC days, today included) for `now`. */
export function siteDailyQueries(now) {
  const today = isoDay(now);
  const since = isoDay(now - 29 * DAY_MS);
  return {
    since,
    today,
    statements: [
      `SELECT day, key AS channel, sum(count) AS downloads FROM site_daily WHERE kind = 'download' AND day >= '${since}' GROUP BY day, key ORDER BY day, key`,
      `SELECT key AS path, sum(count) AS views FROM site_daily WHERE kind = 'view' AND day >= '${since}' GROUP BY key ORDER BY views DESC, path LIMIT 10`,
      `SELECT kind, CASE WHEN kind = 'download' THEN key ELSE '' END AS what, sum(count) AS total, min(day) AS first_day FROM site_daily GROUP BY kind, what ORDER BY kind DESC, what`,
    ],
  };
}

const heading = (text) => `\n${text}\n`;

/** Renders the three result sets of siteDailyQueries as text sections. */
export function renderSiteDaily([downloads, paths, totals], { since, today }) {
  const out = [];

  out.push(heading(`Downloads per channel per day, last 30 days (site_daily, UTC, ${since} to ${today})`));
  const channels = [...new Set(['lite', 'full', ...downloads.map((r) => r.channel)])];
  const byDay = new Map();
  for (const r of downloads) {
    if (!byDay.has(r.day)) byDay.set(r.day, {});
    byDay.get(r.day)[r.channel] = Number(r.downloads);
  }
  const rows = [];
  for (let t = Date.parse(`${since}T00:00:00Z`); isoDay(t) <= today; t += DAY_MS) {
    const day = isoDay(t);
    const counts = channels.map((c) => byDay.get(day)?.[c] ?? 0);
    rows.push([day, ...counts, counts.reduce((a, b) => a + b, 0)]);
  }
  out.push(formatTable(['Day', ...channels, 'Total'], rows, channels.map((_, i) => i + 1).concat(channels.length + 1)));

  out.push(heading('Top 10 paths by page views, last 30 days (site_daily)'));
  out.push(paths.length ? formatTable(['Path', 'Views'], paths.map((r) => [r.path, r.views]), [1]) : 'No page views recorded.');

  out.push(heading('All-time site totals (site_daily, kept forever)'));
  out.push(
    totals.length
      ? formatTable(
          ['What', 'Total', 'Since'],
          totals.map((r) => [r.kind === 'view' ? 'page views' : `downloads · ${r.what}`, r.total, r.first_day]),
          [1],
        )
      : 'Nothing recorded yet.',
  );
  // Why say so: the rollup has no UA class, so bot traffic is in these totals;
  // the Analytics Engine detail below can exclude it.
  out.push('\nsite_daily counts every user agent, bots included; rate-limited requests and HEAD /dl are not counted.');
  return out.join('\n');
}
