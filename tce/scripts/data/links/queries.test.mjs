// The Share links and Campaigns statements run on a real SQLite (node:sqlite)
// with our migrations and a few phones' rows: the numbers each one answers,
// the tester rule, and a database without migration 0005's tables.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { assertReadOnly, d1Statements } from '../queries.mjs';
import { missingNewTable } from './new-tables.mjs';
import { NEW_TABLES } from './queries.mjs';

const MIGRATIONS = fileURLToPath(new URL('../../../stores/sql/migrations/', import.meta.url));
const NOW = Date.parse('2026-11-06T12:00:00Z');
const DAYS = 7; // the window starts 2026-10-31
const at = (iso) => Date.parse(iso);
const [A, B, C, T] = ['abcdefgh', 'bcdefghj', 'cdefghjk', 'tttttttt'];

/** A database with our migrations (only up to 0004 when `upTo` says so) and the sample phones. */
function database({ upTo = 9999 } = {}) {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(MIGRATIONS).filter((x) => /^\d{4}_.*\.sql$/.test(x) && Number(x.slice(0, 4)) <= upTo).sort()) {
    db.exec(readFileSync(MIGRATIONS + f, 'utf8'));
  }
  const insert = (table, rows) => {
    for (const r of rows) {
      const cols = Object.keys(r);
      db.prepare(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(r));
    }
  };
  const device = (device_id, tester = 0) => ({ device_id, hw_hash: 'h', manufacturer: 'Google', model: 'Pixel', sdk_int: 36, abi: 'arm64-v8a', ram_gb: 8, locale: 'en', tester, first_seen: at('2026-10-01'), last_seen: NOW });
  insert('devices', [device('alice'), device('bob'), device('carol'), device('dave'), device('erin'), device('tess', 1)]);
  insert('share_links', [
    { code: A, device_id: 'alice', created: at('2026-10-15') },
    { code: B, device_id: 'bob', created: at('2026-11-03') },
    { code: T, device_id: 'tess', created: at('2026-11-01') },
  ]);
  // bob and dave came back on a later day; carol only on the day she installed.
  insert('share_installs', [
    { device_id: 'bob', code: A, ts: at('2026-11-01T09:00Z'), day: '2026-11-01' },
    { device_id: 'carol', code: A, ts: at('2026-10-20T09:00Z'), day: '2026-10-20' },
    { device_id: 'dave', code: B, ts: at('2026-11-05T09:00Z'), day: '2026-11-05' },
    { device_id: 'tess', code: A, ts: at('2026-11-02T09:00Z'), day: '2026-11-02' },
    { device_id: 'erin', code: T, ts: at('2026-11-03T09:00Z'), day: '2026-11-03' },
  ]);
  const session = (session_id, device_id, iso) => ({ session_id, install_id: 'i', device_id, version: '1.0.0', version_code: 1, channel: 'lite', started: at(iso), received: at(iso) });
  insert('sessions', [session('s1', 'bob', '2026-11-02T10:00Z'), session('s2', 'carol', '2026-10-20T15:00Z'), session('s3', 'dave', '2026-11-06T08:00Z')]);
  const step = (code, s, day, count) => ({ code, step: s, day, count });
  insert('share_daily', [
    step(A, 'open', '2026-10-20', 10),
    step(A, 'open', '2026-11-01', 5),
    step(A, 'download', '2026-11-01', 3),
    step(B, 'open', '2026-11-04', 2),
    step(T, 'open', '2026-11-04', 7),
    step(C, 'download', '2026-11-05', 1),
  ]);
  if (upTo >= 5) {
    insert('campaign_daily', [
      { tag: 'hn', step: 'open', day: '2026-10-20', count: 100 },
      { tag: 'hn', step: 'open', day: '2026-11-05', count: 20 },
      { tag: 'hn', step: 'download', day: '2026-11-05', count: 6 },
    ]);
    insert('campaigns', [
      { tag: 'reddit', note: 'r/androiddev thread', added: '2026-11-04' },
      { tag: 'hn', note: 'Hacker News launch post', added: '2026-10-19' },
    ]);
  }
  return db;
}

/** Runs the whole batch, in order, as D1 would; { name: rows }. */
function runBatch(db, options = {}) {
  const statements = d1Statements({ now: NOW, days: DAYS, ...options });
  assertReadOnly(statements);
  const out = {};
  for (const s of statements) out[s.name] = db.prepare(s.sql).all().map((r) => ({ ...r }));
  return out;
}

/** Rows in day order (the earlier days' '' first), then step. */
const byDay = (rows) => {
  const key = (r) => JSON.stringify([r.day, r.step ?? '']);
  return [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
};

test('every statement runs on our schema; the ones that read the new tables come first, the newest first', () => {
  const statements = d1Statements({ now: NOW, days: DAYS });
  const firstOld = statements.findIndex((s) => !NEW_TABLES.some((t) => s.sql.includes(t)));
  assert.ok(firstOld > 0);
  assert.ok(statements.slice(firstOld).every((s) => !NEW_TABLES.some((t) => s.sql.includes(t))));
  assert.deepEqual(statements.slice(0, 2).map((s) => s.name), ['campaignList', 'campaignDaily']);
  assert.equal(d1Statements({ now: NOW, days: DAYS, missing: ['campaigns'] })[0].name, 'campaignDaily');
  assert.doesNotThrow(() => runBatch(database()));
  assert.doesNotThrow(() => runBatch(database(), { testers: true }));
});

test('links sent, opens and downloads: earlier days fold into one row, tester links left out', () => {
  const r = runBatch(database());
  assert.deepEqual(r.shareLinks, [{ links: 2, links_new: 1, sharers: 2 }]);
  assert.deepEqual(byDay(r.shareDaily), [
    { day: '', step: 'open', n: 10 },
    { day: '2026-11-01', step: 'download', n: 3 },
    { day: '2026-11-01', step: 'open', n: 5 },
    { day: '2026-11-04', step: 'open', n: 2 },
    { day: '2026-11-05', step: 'download', n: 1 },
  ]);
  const shown = runBatch(database(), { testers: true });
  assert.equal(shown.shareLinks[0].links, 3);
  assert.equal(shown.shareDaily.find((x) => x.day === '2026-11-04').n, 9); // the tester link's 7 opens join B's 2
});

test('installs: still using means a session on a later UTC day, as the app counts it', () => {
  const r = runBatch(database());
  assert.deepEqual(byDay(r.shareInstalls), [
    { day: '', n: 1, still_using: 0 }, // carol: a session on her install day only
    { day: '2026-11-01', n: 1, still_using: 1 }, // bob
    { day: '2026-11-05', n: 1, still_using: 1 }, // dave
  ]);
  // With testers: tess's own install, and erin's through a tester's link.
  assert.equal(runBatch(database(), { testers: true }).shareInstalls.reduce((a, x) => a + x.n, 0), 5);
});

test('top links: ranked by installs, with their counts; tester installs and links left out', () => {
  assert.deepEqual(runBatch(database()).shareTop, [
    { code: A, installs: 2, still_using: 1, opens: 15, downloads: 3 },
    { code: B, installs: 1, still_using: 1, opens: 2, downloads: 0 },
  ]);
});

test('who brings in whom: bob came through a link and brought dave', () => {
  assert.deepEqual(runBatch(database()).shareSecond, [{ came: 3, sharers: 1, installs: 1 }]);
});

test('campaigns: per tag and step, earlier days folded, the last day seen', () => {
  assert.deepEqual(byDay(runBatch(database()).campaignDaily), [
    { tag: 'hn', step: 'open', day: '', n: 100, last_day: '2026-10-20' },
    { tag: 'hn', step: 'download', day: '2026-11-05', n: 6, last_day: '2026-11-05' },
    { tag: 'hn', step: 'open', day: '2026-11-05', n: 20, last_day: '2026-11-05' },
  ]);
});

test('the campaigns list: every campaign we made, oldest first', () => {
  assert.deepEqual(runBatch(database()).campaignList, [
    { tag: 'hn', note: 'Hacker News launch post', added: '2026-10-19' },
    { tag: 'reddit', note: 'r/androiddev thread', added: '2026-11-04' },
  ]);
});

test('before migration 0005: the batch fails on its first statement, and reads without the new tables', () => {
  const db = database({ upTo: 4 });
  const [first] = d1Statements({ now: NOW, days: DAYS });
  let message = '';
  try {
    db.prepare(first.sql).all();
  } catch (e) {
    message = e.message;
  }
  assert.match(message, /no such table/);
  assert.ok(NEW_TABLES.includes(missingNewTable(message)), message);
  const r = runBatch(db, { missing: NEW_TABLES });
  assert.equal(r.campaignDaily, undefined);
  assert.equal(r.campaignList, undefined);
  assert.deepEqual(r.shareTop.map((x) => [x.code, x.installs]), [
    [A, 2],
    [B, 1],
  ]);
  assert.deepEqual(r.shareSecond, [{ came: 3, sharers: 1, installs: 1 }]);
  for (const s of d1Statements({ now: NOW, days: DAYS, missing: NEW_TABLES })) {
    assert.ok(!NEW_TABLES.some((t) => s.sql.includes(t)), s.name);
  }
});
