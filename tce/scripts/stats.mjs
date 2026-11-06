#!/usr/bin/env node
// PhoneCanDo usage numbers, read-only. Zero deps (node:* only).
//
//   node tce/scripts/stats.mjs [--d1]        (./manage stats [--d1], pnpm -C tce stats)
//
// Default: GitHub release download counts per tag and asset from the public
// API (GITHUB_TOKEN, optional, only raises the 60 requests/hour limit). The
// repo comes from web/src/data/release.json, the current version from
// app/app.json. latest.json is fetched by every launch-time update check of
// the full and lite apps, so its count is "update checks ≈ app launches".
//
// --d1 adds summaries from the remote D1 database through the `cf` CLI
// (`cf d1 query`, logged in; the database id is read from
// tce/hosts/cloudflare/wrangler.jsonc). Only SELECTs run. Tester devices are
// excluded. Site page views and /dl downloads: daily totals from the
// `site_daily` rollup in D1 (kept forever; scripts/site-daily.mjs), and the
// `cf analytics-engine sql query` commands for the ~3-month detail in
// Analytics Engine.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { renderSiteDaily, siteDailyQueries } from './site-daily.mjs';
import { formatTable } from './text-table.mjs';
import { ROOT, d1DatabaseOf, readWranglerConfig } from './wrangler-config.mjs';

const DAY_MS = 86_400_000;

const HELP = `usage: node tce/scripts/stats.mjs [--d1]

  (default)  GitHub release downloads per tag and asset (public API;
             GITHUB_TOKEN optional, raises the rate limit)
  --d1       also query the remote D1 database through the cf CLI (read-only)
  -h --help  this text`;

let args;
try {
  args = parseArgs({ options: { d1: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } } }).values;
} catch (e) {
  console.error(`stats: ${e.message}\n\n${HELP}`);
  process.exit(2);
}
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

const readJson = (rel) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const { repo } = readJson('web/src/data/release.json');
const version = readJson('app/app.json').expo.version;

// ---------- output ----------

/** Prints rows as an aligned text table; `right` lists the right-aligned column indexes. */
const table = (head, rows, right = []) => console.log(formatTable(head, rows, right));

const heading = (text) => console.log(`\n${text}\n`);

// ---------- GitHub ----------

async function github(path) {
  const headers = { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'phonecando-stats' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const url = `https://api.github.com${path}`;
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) return res.json();
      if ((res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0') {
        throw new Error(`${url}: GitHub API rate limit reached; set GITHUB_TOKEN to raise it`);
      }
      last = new Error(`${url}: HTTP ${res.status}`);
      if (res.status < 500) break; // 404 and friends do not get better on retry
    } catch (e) {
      if (/rate limit/.test(e.message)) throw e;
      last = e;
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  throw last;
}

async function allReleases() {
  const out = [];
  for (let page = 1; ; page++) {
    const batch = await github(`/repos/${repo}/releases?per_page=100&page=${page}`);
    out.push(...batch);
    if (batch.length < 100) return out;
  }
}

/** What a release asset's download count measures. */
function counts(name) {
  if (name === 'latest.json') return 'update checks ≈ app launches';
  if (/-lite-[^/]*\.apk$/.test(name)) return 'starter APK: site buttons, QR, direct links';
  if (/-full-[^/]*\.apk$/.test(name)) return 'full APK: in-app install/update, adb';
  if (/^phonecando-[^-]+-arm64\.apk$/.test(name)) return 'APK from before the lite/full split';
  return '';
}

async function githubSection() {
  const [meta, releases] = await Promise.all([github(`/repos/${repo}`), allReleases()]);
  heading(`GitHub · ${repo} · ${meta.stargazers_count} stars · ${meta.forks_count} forks · ${meta.subscribers_count} watchers`);
  const rows = [];
  const totals = new Map();
  for (const rel of releases) {
    if (rel.draft) continue;
    const tag = rel.tag_name + (rel.tag_name === `v${version}` ? ' *' : '') + (rel.prerelease ? ' (pre)' : '');
    const date = (rel.published_at ?? rel.created_at ?? '').slice(0, 10);
    const assets = [...(rel.assets ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    if (!assets.length) rows.push([tag, date, '(no assets)', '', '']);
    assets.forEach((a, i) => {
      rows.push([i === 0 ? tag : '', i === 0 ? date : '', a.name, a.download_count, counts(a.name)]);
      const what = counts(a.name) || 'other assets';
      totals.set(what, (totals.get(what) ?? 0) + a.download_count);
    });
  }
  if (!rows.length) {
    console.log('No published releases.');
    return;
  }
  table(['Tag', 'Published', 'Asset', 'Downloads', 'Counts'], rows, [3]);
  heading('All releases');
  table(['Counts', 'Downloads'], [...totals].sort((a, b) => b[1] - a[1]), [1]);
  console.log(`\n* current version (app/app.json v${version}). GitHub counts every fetch, including retries and bots.`);
}

// ---------- D1 (cf CLI) ----------

/** Runs read-only statements in one `cf d1 query` call; returns one row array per statement. */
function d1Query(databaseId, statements) {
  for (const s of statements) {
    if (!/^\s*(select|with)\b/i.test(s)) throw new Error(`refusing a non-SELECT statement: ${s.slice(0, 40)}`);
  }
  const r = spawnSync('cf', ['d1', 'query', databaseId, '--sql', statements.join(';\n')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error?.code === 'ENOENT') throw new Error('the cf CLI is not on PATH (npm i -g cf, then cf auth login; with nvm, source it first)');
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`cf d1 query exited ${r.status}:\n${(r.stderr || r.stdout).trim()}`);
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    throw new Error(`cf d1 query printed something other than JSON:\n${r.stdout.slice(0, 500)}`);
  }
  // The API's `result` (an array with one entry per statement), bare or wrapped.
  const results = Array.isArray(parsed) ? parsed : parsed.result;
  if (!Array.isArray(results) || results.length !== statements.length) {
    throw new Error(`cf d1 query returned ${Array.isArray(results) ? results.length : 'no'} result sets for ${statements.length} statements`);
  }
  return results.map((res, i) => {
    if (res.success === false) throw new Error(`statement ${i + 1} failed: ${JSON.stringify(res.error ?? res)}`);
    return res.results ?? [];
  });
}

function d1Section() {
  const config = readWranglerConfig();
  const db = d1DatabaseOf(config);
  const now = Date.now();
  const todayStart = now - (now % DAY_MS);
  const weekStart = todayStart - 6 * DAY_MS;
  const monthAgo = now - 30 * DAY_MS;
  // Tester devices are our own test phones (Settings → About, long press).
  const real = 'device_id IN (SELECT device_id FROM devices WHERE tester = 0)';
  const [devices, channels, daily, versions, errors] = d1Query(db.database_id, [
    `SELECT count(*) AS devices, coalesce(sum(last_seen >= ${monthAgo}), 0) AS seen_30d FROM devices WHERE tester = 0`,
    `SELECT channel, count(*) AS installs FROM installs WHERE ${real} GROUP BY channel ORDER BY installs DESC`,
    `SELECT date(started / 1000, 'unixepoch') AS day, count(DISTINCT device_id) AS devices, count(*) AS sessions FROM sessions WHERE started >= ${weekStart} AND ${real} GROUP BY day ORDER BY day`,
    `SELECT last_version AS version, count(*) AS installs FROM installs WHERE last_seen >= ${monthAgo} AND ${real} GROUP BY last_version ORDER BY installs DESC`,
    `SELECT error_key, min(kind) AS kind, min(version) AS version, min(class_name) AS class_name, substr(min(message), 1, 60) AS message, count(DISTINCT device_id) AS devices, count(*) AS errors FROM errors WHERE ${real} GROUP BY error_key ORDER BY devices DESC, errors DESC LIMIT 10`,
  ]);

  heading(`D1 · ${db.database_name ?? db.database_id} · tester devices excluded`);
  const d = devices[0] ?? { devices: 0, seen_30d: 0 };
  console.log(`Devices: ${d.devices} total, ${d.seen_30d} seen in the last 30 days`);

  heading('Installs by channel');
  table(['Channel', 'Installs'], channels.map((r) => [r.channel, r.installs]), [1]);

  heading('Daily active devices, last 7 days (UTC, by session start)');
  const byDay = new Map(daily.map((r) => [r.day, r]));
  const days = [];
  for (let t = weekStart; t <= todayStart; t += DAY_MS) {
    const day = new Date(t).toISOString().slice(0, 10);
    const r = byDay.get(day);
    days.push([day, r?.devices ?? 0, r?.sessions ?? 0]);
  }
  table(['Day', 'Devices', 'Sessions'], days, [1, 2]);

  heading('Versions in use (installs seen in the last 30 days, by last version)');
  table(['Version', 'Installs'], versions.map((r) => [r.version, r.installs]), [1]);

  heading('Top 10 errors by devices (errors are kept 180 days)');
  if (!errors.length) console.log('No errors recorded.');
  else
    table(
      ['Devices', 'Errors', 'Kind', 'Version', 'Class', 'Message', 'Key'],
      errors.map((r) => [r.devices, r.errors, r.kind, r.version, r.class_name, r.message, String(r.error_key).slice(0, 12)]),
      [0, 1],
    );

  siteDailySection(db.database_id, now);
  aeHint(config);
}

/** site_daily summaries, in their own query so a database without migration 0003 still prints the rest. */
function siteDailySection(databaseId, now) {
  const q = siteDailyQueries(now);
  let results;
  try {
    results = d1Query(databaseId, q.statements);
  } catch (e) {
    if (!/no such table: site_daily/.test(e.message)) throw e;
    heading('Site page views and downloads (site_daily)');
    console.log('site_daily does not exist yet: apply migration 0003 (tce/README.md, Deploys).');
    return;
  }
  console.log(renderSiteDaily(results, q));
}

/** Analytics Engine has no cf d1-style summary here: print ready-to-run queries. */
function aeHint(config) {
  const datasets = Object.fromEntries((config.analytics_engine_datasets ?? []).map((d) => [d.binding, d.dataset]));
  const pageviews = datasets.PAGEVIEWS ?? 'phonecando_pageviews';
  const downloads = datasets.DOWNLOADS ?? 'phonecando_downloads';
  const week = "timestamp > NOW() - INTERVAL '7' DAY";
  heading('Site page views and /dl downloads in detail (Analytics Engine, no identity, ~3 months kept)');
  console.log('The detail is not in D1 (site_daily keeps daily totals only). Run these yourself (read-only, sample-weighted):\n');
  console.log(
    `  cf analytics-engine sql query --body "SELECT blob1 AS path, SUM(_sample_interval * double1) AS views FROM ${pageviews} WHERE ${week} AND blob4 != 'bot' GROUP BY path ORDER BY views DESC LIMIT 20"`,
  );
  console.log(
    `  cf analytics-engine sql query --body "SELECT blob1 AS channel, blob2 AS version, SUM(_sample_interval * double1) AS downloads FROM ${downloads} WHERE ${week} AND blob6 != 'bot' GROUP BY channel, version ORDER BY downloads DESC"`,
  );
  console.log('\nColumns (tce/stores/cloudflare/analytics.ts): page views blob1 path, blob2 referrer host,');
  console.log('blob3 country, blob4 UA class; downloads blob1 channel, blob2 version, blob3 country,');
  console.log('blob4 Android major, blob5 referrer host, blob6 UA class; double1 = 1 per point.');
}

// ---------- main ----------

try {
  await githubSection();
} catch (e) {
  console.error(`\nstats: GitHub: ${e.message}`);
  process.exitCode = 1;
}
if (args.d1) {
  try {
    d1Section();
  } catch (e) {
    console.error(`\nstats: D1: ${e.message}`);
    process.exitCode = 1;
  }
}
