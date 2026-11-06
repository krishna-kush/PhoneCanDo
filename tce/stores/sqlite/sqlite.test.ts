// node:sqlite specifics: migrations across restarts, pragmas, transaction
// rollback in the driver, the local point tables next to the site_daily
// rollup, and usage() from the file's page count. Shared SQL behaviour (merge
// rules, chunking, the ingest gate) is covered in stores/sql.

import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';
import type { Clock } from '../../core/clock.ts';
import type { Logger } from '../../core/op.ts';
import { applyMigrations, defaultMigrations } from './migrate.ts';
import { createSqliteStore, openSqliteDatabase } from './store.ts';
import { DEVICE_ID, T0, batchWrite, downloadPoint, eventRow, pagePoint } from '../../testkit/fixtures.ts';

const tmp = mkdtempSync(join(tmpdir(), 'tce-sqlite-'));
after(() => rmSync(tmp, { recursive: true, force: true }));
let n = 0;
/** A fresh database file path in the temp directory. */
const dbPath = (): string => join(tmp, `t${n++}.db`);

const clock: Clock = { now: () => T0 };
const quiet: Logger = { info() {}, warn() {}, error() {} };

describe('migrations', () => {
  test('a new file gets the shared and local schema; a reopen applies nothing and keeps data', async () => {
    const path = dbPath();
    const first = openSqliteDatabase(path, { clock });
    assert.deepEqual(first.applied, ['0001_init.sql', '0002_ownership_indexes.sql', '0003_site_daily.sql', 'sqlite/0001_points.sql']);
    const tables = (first.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(
      (r) => r.name,
    );
    assert.deepEqual(tables, [
      '_tce_migrations',
      'devices',
      'errors',
      'events',
      'github_assets_daily',
      'github_repo_daily',
      'installs',
      'points_downloads',
      'points_pageviews',
      'reports',
      'sessions',
      'site_daily',
    ]);
    first.close();

    const { store, close } = createSqliteStore(path, { clock, log: quiet });
    assert.equal((await store.applyBatch(batchWrite())).ok, true);
    await close();

    const again = openSqliteDatabase(path, { clock });
    assert.deepEqual(again.applied, []);
    assert.deepEqual(
      again.db.prepare('SELECT name, applied_at FROM _tce_migrations ORDER BY name').all().map((r) => ({ ...r })),
      [
        { name: '0001_init.sql', applied_at: T0 },
        { name: '0002_ownership_indexes.sql', applied_at: T0 },
        { name: '0003_site_daily.sql', applied_at: T0 },
        { name: 'sqlite/0001_points.sql', applied_at: T0 },
      ],
    );
    assert.equal((again.db.prepare('SELECT count(*) AS n FROM events').get() as { n: number }).n, 1);
    again.close();
  });

  test('migrations run in file order and a failing one rolls back and stops the open', () => {
    const path = dbPath();
    const migrations = [
      { name: '0001_a.sql', sql: 'CREATE TABLE a (x INTEGER);' },
      { name: '0002_b.sql', sql: 'CREATE TABLE b (x INTEGER); INSERT INTO missing VALUES (1);' },
      { name: '0003_c.sql', sql: 'CREATE TABLE c (x INTEGER);' },
    ];
    assert.throws(() => openSqliteDatabase(path, { clock, migrations }), (e: unknown) => {
      assert.ok(e instanceof Error);
      assert.match(e.message, /migration 0002_b\.sql failed: .*missing/);
      return true;
    });
    const h = openSqliteDatabase(path, { clock, migrations: migrations.slice(0, 1) });
    assert.deepEqual(h.applied, [], '0001 was committed before 0002 failed');
    const names = (h.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map(
      (r) => r.name,
    );
    assert.deepEqual(names, ['_tce_migrations', 'a'], 'table b was rolled back, c never ran');
    h.close();
  });

  test('every shared migration file is applied, in order (0001, 0002, 0003): verifier column, ownership indexes, site_daily', () => {
    const shared = readdirSync(new URL('../sql/migrations/', import.meta.url)).filter((f) => f.endsWith('.sql')).sort();
    assert.deepEqual(shared.slice(0, 3), ['0001_init.sql', '0002_ownership_indexes.sql', '0003_site_daily.sql']);
    assert.deepEqual(
      defaultMigrations().map((m) => m.name),
      [...shared, 'sqlite/0001_points.sql'],
    );
    const h = openSqliteDatabase(':memory:', { clock });
    const columns = (h.db.prepare('PRAGMA table_info(devices)').all() as { name: string; notnull: number }[]).map((c) => [c.name, c.notnull]);
    assert.deepEqual(columns.at(-1), ['verifier', 0]);
    const indexes = (h.db.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as {
      name: string;
      tbl_name: string;
    }[]).map((r) => `${r.tbl_name}.${r.name}`);
    for (const ix of ['errors.errors_device', 'reports.reports_device', 'reports.reports_received', 'sessions.sessions_device', 'installs.installs_device']) {
      assert.ok(indexes.includes(ix), `${ix} in ${indexes.join(', ')}`);
    }
    const site = (h.db.prepare('PRAGMA table_info(site_daily)').all() as { name: string; pk: number; notnull: number }[]).map((c) => [c.name, c.pk, c.notnull]);
    assert.deepEqual(site, [
      ['day', 1, 1],
      ['kind', 2, 1],
      ['key', 3, 1],
      ['country', 4, 1],
      ['count', 0, 1],
    ]);
    const sql = (h.db.prepare("SELECT sql FROM sqlite_master WHERE name = 'site_daily'").get() as { sql: string }).sql;
    assert.match(sql, /WITHOUT ROWID/);
    h.close();
  });

  test('a database at 0001 only (the live schema before 0002) upgrades in place and keeps its rows', async () => {
    const path = dbPath();
    const [init] = defaultMigrations();
    const old = openSqliteDatabase(path, { clock, migrations: [init!] });
    old.db
      .prepare(
        `INSERT INTO devices (device_id, hw_hash, manufacturer, model, sdk_int, abi, ram_gb, locale, tester, first_seen, last_seen)
         VALUES (?, 'h', 'Google', 'Pixel 8', 36, 'arm64-v8a', 8, 'en-IN', 0, ?, ?)`,
      )
      .run(DEVICE_ID, T0, T0);
    old.close();
    const upgraded = openSqliteDatabase(path, { clock });
    assert.deepEqual(upgraded.applied, ['0002_ownership_indexes.sql', '0003_site_daily.sql', 'sqlite/0001_points.sql']);
    assert.deepEqual({ ...(upgraded.db.prepare('SELECT device_id, verifier FROM devices').get() as object) }, { device_id: DEVICE_ID, verifier: null });
    upgraded.close();
  });

  test('a database at 0002 (the live schema before 0003) gains site_daily in place; its rows stay and points roll up', async () => {
    const path = dbPath();
    const all = defaultMigrations();
    const old = openSqliteDatabase(path, { clock, migrations: all.filter((m) => m.name !== '0003_site_daily.sql') });
    old.close();
    const before = createSqliteStore(path, { clock, log: quiet, migrations: all.filter((m) => m.name !== '0003_site_daily.sql') });
    assert.equal((await before.store.applyBatch(batchWrite())).ok, true);
    await before.close();
    const { store, close } = createSqliteStore(path, { clock, log: quiet });
    assert.deepEqual(await store.writePagePoint(pagePoint({ day: '2026-11-01' })), { ok: true, value: undefined });
    assert.deepEqual(await store.listSiteDaily('2026-11-01', '2026-11-01'), {
      ok: true,
      value: [{ day: '2026-11-01', kind: 'view', key: '/', country: 'IN', count: 1 }],
    });
    await close();
    const again = openSqliteDatabase(path, { clock });
    assert.deepEqual(again.applied, []);
    assert.equal((again.db.prepare('SELECT count(*) AS n FROM events').get() as { n: number }).n, 1);
    again.close();
  });

  test('applyMigrations is idempotent on one connection', () => {
    const h = openSqliteDatabase(':memory:', { clock });
    assert.deepEqual(applyMigrations(h.db, defaultMigrations(), clock), []);
    h.close();
  });
});

describe('pragmas', () => {
  test('files use WAL with a busy timeout; memory databases stay in memory mode', () => {
    const file = openSqliteDatabase(dbPath(), { clock });
    assert.equal((file.db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode, 'wal');
    assert.equal((file.db.prepare('PRAGMA busy_timeout').get() as { timeout: number }).timeout, 5000);
    file.close();
    const mem = openSqliteDatabase(':memory:', { clock });
    assert.equal((mem.db.prepare('PRAGMA journal_mode').get() as { journal_mode: string }).journal_mode, 'memory');
    mem.close();
  });
});

describe('driver transactions', () => {
  test('a failing statement rolls back the statements before it and leaves no open transaction', async () => {
    const h = openSqliteDatabase(':memory:', { clock });
    const ok = { sql: "INSERT INTO github_assets_daily VALUES ('2026-11-01', 'v1', 'a', 1)", params: [] };
    const bad = { sql: 'INSERT INTO github_assets_daily VALUES (?, ?, ?, ?)', params: ['2026-11-01', 'v1', null, 2] }; // asset NOT NULL
    await assert.rejects(h.driver.batch([ok, bad]), /NOT NULL/);
    assert.equal(h.db.isTransaction, false);
    assert.equal((h.db.prepare('SELECT count(*) AS n FROM github_assets_daily').get() as { n: number }).n, 0);
    assert.deepEqual(await h.driver.batch([ok]), [{ changes: 1 }]);
    assert.deepEqual(await h.driver.all('SELECT asset, download_count FROM github_assets_daily', []), [
      Object.assign(Object.create(null), { asset: 'a', download_count: 1 }),
    ]);
    assert.deepEqual(await h.driver.batch([]), []);
    h.close();
  });

  test('a batch inside a foreign open transaction fails without rolling that transaction back', async () => {
    const h = openSqliteDatabase(':memory:', { clock });
    h.db.exec('BEGIN');
    h.db.exec("INSERT INTO github_repo_daily (day, stars, forks, watchers) VALUES ('d', 1, 1, 1)");
    await assert.rejects(h.driver.batch([{ sql: 'SELECT 1', params: [] }]), /transaction/);
    assert.equal(h.db.isTransaction, true, 'the caller still owns its transaction');
    h.db.exec('COMMIT');
    assert.equal((h.db.prepare('SELECT count(*) AS n FROM github_repo_daily').get() as { n: number }).n, 1);
    h.close();
  });

  test('two stores on one file see each other’s writes (WAL, separate connections)', async () => {
    const path = dbPath();
    const a = createSqliteStore(path, { clock, log: quiet });
    const b = createSqliteStore(path, { clock, log: quiet });
    assert.equal((await a.store.applyBatch(batchWrite())).ok, true);
    const r = await b.store.applyBatch(batchWrite({ events: [eventRow(), eventRow({ seq: 2 })] }));
    assert.deepEqual(r, { ok: true, value: { sessions: 1, events: 1, errors: 0 } });
    await a.close();
    await b.close();
  });
});

describe('points', () => {
  test('page and download points land in the local tables, stamped by the clock, and in the site_daily rollup', async () => {
    const path = dbPath();
    const { store, close } = createSqliteStore(path, { clock, log: quiet });
    assert.deepEqual(await store.writePagePoint(pagePoint({ day: '2026-11-01', path: '/install', refHost: 'google.com' })), { ok: true, value: undefined });
    assert.deepEqual(await store.writeDownloadPoint(downloadPoint({ day: '2026-11-01', androidMajor: null })), { ok: true, value: undefined });
    assert.deepEqual(await store.writeDownloadPoint(downloadPoint({ day: '2026-11-01', androidMajor: 15 })), { ok: true, value: undefined });
    assert.deepEqual(await store.listSiteDaily('2026-11-01', '2026-11-01'), {
      ok: true,
      value: [
        { day: '2026-11-01', kind: 'download', key: 'lite', country: 'IN', count: 2 },
        { day: '2026-11-01', kind: 'view', key: '/install', country: 'IN', count: 1 },
      ],
    });
    await close();
    const h = openSqliteDatabase(path, { clock });
    assert.deepEqual({ ...(h.db.prepare('SELECT * FROM points_pageviews').get() as object) }, {
      ts: T0,
      path: '/install',
      ref_host: 'google.com',
      country: 'IN',
      ua_class: 'android',
    });
    assert.deepEqual({ ...(h.db.prepare('SELECT * FROM points_downloads').get() as object) }, {
      ts: T0,
      channel: 'lite',
      version: '0.1.2',
      country: 'IN',
      android_major: null,
      ref_host: null,
      ua_class: 'android',
    });
    assert.equal((h.db.prepare('SELECT count(*) AS n FROM points_downloads').get() as { n: number }).n, 2, 'one detailed point per download');
    h.close();
  });
});

describe('usage', () => {
  test('dbBytes is page_count * page_size of the file and grows with it; ingest is never paused', async () => {
    const path = dbPath();
    const { store, driver, close } = createSqliteStore(path, { clock, log: quiet });
    const first = await store.usage();
    assert.ok(first.ok);
    const [pages] = await driver.all<{ page_count: number }>('PRAGMA page_count', []);
    const [size] = await driver.all<{ page_size: number }>('PRAGMA page_size', []);
    assert.deepEqual(first.value, {
      dbBytes: pages!.page_count * size!.page_size,
      ingestPaused: false,
      oldestReceived: { events: null, errors: null, reports: null },
    });
    const props = JSON.stringify({ k: 'v'.repeat(400) });
    const events = Array.from({ length: 200 }, (_, i) => eventRow({ seq: i, props }));
    assert.equal((await store.applyBatch(batchWrite({ events }))).ok, true);
    const second = await store.usage();
    assert.ok(second.ok);
    assert.ok(second.value.dbBytes! > first.value.dbBytes!, `${second.value.dbBytes} > ${first.value.dbBytes}`);
    await close();
    // Checkpointed on close, the file holds exactly those pages.
    assert.equal(statSync(path).size, second.value.dbBytes);
  });

  test('a memory database reports its size too', async () => {
    const { store, close } = createSqliteStore(':memory:', { clock, log: quiet });
    const r = await store.usage();
    assert.ok(r.ok && typeof r.value.dbBytes === 'number' && r.value.dbBytes > 0);
    await close();
  });
});

describe('close', () => {
  test('close is idempotent and later calls are unavailable, not throws', async () => {
    const { store, close } = createSqliteStore(':memory:', { log: quiet });
    await close();
    await close();
    const r = await store.forget(DEVICE_ID, 'ab'.repeat(32));
    assert.equal(!r.ok && r.error.code, 'unavailable');
    const p = await store.writePagePoint(pagePoint());
    assert.equal(!p.ok && p.error.code, 'unavailable');
  });
});
