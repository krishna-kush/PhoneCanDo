// Tests scripts/site-daily.mjs: its SQL runs against the real migration 0003
// in node:sqlite (D1 is SQLite), and the rendering of the results.
//   node --test tce/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { renderSiteDaily, siteDailyQueries } from './site-daily.mjs';
import { TCE } from './wrangler-config.mjs';

const NOW = Date.parse('2026-11-06T15:00:00Z');

function database(rows) {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(TCE, 'stores/sql/migrations/0003_site_daily.sql'), 'utf8'));
  const insert = db.prepare('INSERT INTO site_daily (day, kind, key, country, count) VALUES (?, ?, ?, ?, ?)');
  for (const r of rows) insert.run(...r);
  return db;
}

const query = (db, statements) => statements.map((s) => db.prepare(s).all().map((r) => ({ ...r })));

test('siteDailyQueries: a 30-day UTC window ending today, SELECTs only', () => {
  const q = siteDailyQueries(NOW);
  assert.equal(q.today, '2026-11-06');
  assert.equal(q.since, '2026-10-08');
  assert.equal(q.statements.length, 3);
  for (const s of q.statements) assert.match(s, /^SELECT /);
});

test('the queries sum across countries, window and kinds; totals cover all time', () => {
  const db = database([
    ['2026-11-06', 'download', 'lite', 'IN', 3],
    ['2026-11-06', 'download', 'lite', '', 2],
    ['2026-11-06', 'download', 'full', 'DE', 1],
    ['2026-11-01', 'download', 'full', 'IN', 4],
    ['2026-10-08', 'view', '/', 'IN', 10],
    ['2026-11-05', 'view', '/', 'US', 5],
    ['2026-11-05', 'view', '/privacy', 'US', 7],
    ['2026-10-07', 'view', '/old', 'IN', 100], // outside the 30 days
    ['2026-10-07', 'download', 'lite', 'IN', 50], // outside the 30 days
  ]);
  const q = siteDailyQueries(NOW);
  const [downloads, paths, totals] = query(db, q.statements);
  assert.deepEqual(downloads, [
    { day: '2026-11-01', channel: 'full', downloads: 4 },
    { day: '2026-11-06', channel: 'full', downloads: 1 },
    { day: '2026-11-06', channel: 'lite', downloads: 5 },
  ]);
  assert.deepEqual(paths, [
    { path: '/', views: 15 },
    { path: '/privacy', views: 7 },
  ]);
  assert.deepEqual(totals, [
    { kind: 'view', what: '', total: 122, first_day: '2026-10-07' },
    { kind: 'download', what: 'full', total: 5, first_day: '2026-11-01' },
    { kind: 'download', what: 'lite', total: 55, first_day: '2026-10-07' },
  ]);

  const text = renderSiteDaily([downloads, paths, totals], q);
  const lines = text.split('\n');
  assert.ok(lines.includes('Downloads per channel per day, last 30 days (site_daily, UTC, 2026-10-08 to 2026-11-06)'));
  assert.match(text, /^Day\s+lite\s+full\s+Total$/m);
  assert.match(text, /^2026-10-08\s+0\s+0\s+0$/m, 'days without downloads show zeros');
  assert.match(text, /^2026-11-06\s+5\s+1\s+6$/m);
  assert.equal(lines.filter((l) => /^\d{4}-\d{2}-\d{2}\s+\d/.test(l) && !/\s\d{4}-/.test(l)).length, 30, 'one row per day');
  assert.match(text, /^\/privacy\s+7$/m);
  assert.match(text, /^page views\s+122\s+2026-10-07$/m);
  assert.match(text, /^downloads · lite\s+55\s+2026-10-07$/m);
  assert.match(text, /bots included/);
});

test('an empty table renders placeholders, not errors', () => {
  const q = siteDailyQueries(NOW);
  const text = renderSiteDaily(query(database([]), q.statements), q);
  assert.match(text, /No page views recorded\./);
  assert.match(text, /Nothing recorded yet\./);
  assert.match(text, /^2026-11-06\s+0\s+0\s+0$/m);
});
