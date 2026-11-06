// The Cloudflare store's storage guard, over a fake D1 backed by node:sqlite
// (the full schema, real SQL) whose results report a database size the test
// controls. Local D1 cannot be made to report 450 MB, so this is where the
// thresholds, the block window, the skipped site_daily rollup, usage() and
// what stays allowed are proven.

import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { Logger } from '../../core/op.ts';
import { CAPACITY } from '../../core/schema/limits.ts';
import type { DeviceRow } from '../../core/schema/rows.ts';
import type { BatchWrite } from '../../core/store.ts';
import { openSqliteDatabase } from '../sqlite/store.ts';
import type { SqliteDatabase } from '../sqlite/store.ts';
import { DAY_MS, DEVICE_ID, T0, batchWrite, deviceRow, downloadPoint, eventRow, pagePoint, reportRow } from '../../testkit/fixtures.ts';
import {
  ISOLATE_STORAGE_GUARD,
  STORAGE_BLOCK_MS,
  STORAGE_LIMIT_BYTES,
  createStorageGuard,
  createStorageGuardState,
} from './guard.ts';
import type { StorageGuardState } from './guard.ts';
import { OLDEST_RECEIVED } from '../sql/store.ts';
import { D1_SIZE_PROBE } from './d1.ts';

/** oldestReceived of a database with no retained rows. */
const NONE = { events: null, errors: null, reports: null };
import { createCloudflareStore } from './store.ts';

const VERIFIER = '0a'.repeat(32);
const MB = 1_000_000;

/** A write for DEVICE_ID with a pinned verifier. */
const write = (over: Partial<BatchWrite> = {}): BatchWrite => batchWrite({ ...over, device: pinned() });

/** DEVICE_ID's device row with VERIFIER (what a report hands insertReport). */
function pinned(): DeviceRow {
  return deviceRow({ verifier: VERIFIER });
}

/** Logger that keeps every line. */
function memoryLog(): Logger & { lines: { level: string; message: string; data?: Record<string, unknown> }[] } {
  const lines: { level: string; message: string; data?: Record<string, unknown> }[] = [];
  const at = (level: string) => (message: string, data?: Record<string, unknown>) => void lines.push({ level, message, ...(data ? { data } : {}) });
  return { lines, info: at('info'), warn: at('warn'), error: at('error') };
}

/** Fake D1 binding over a node:sqlite connection: what createD1Driver uses (prepare/bind/all/batch), with a settable size_after. */
interface FakeD1 {
  binding: D1Database;
  /** meta.size_after of every result from now on; undefined omits it. */
  size: number | undefined;
  /** SQL text of every statement executed, in order. */
  executed: string[];
}

function fakeD1(db: DatabaseSync): FakeD1 {
  const fake: FakeD1 = { binding: undefined as unknown as D1Database, size: 1 * MB, executed: [] };
  const meta = (changes: number) => ({
    duration: 0,
    rows_read: 0,
    rows_written: changes,
    last_row_id: 0,
    changed_db: changes > 0,
    changes,
    ...(fake.size === undefined ? {} : { size_after: fake.size }),
  });
  const bound = (sql: string, params: unknown[]) => ({
    sql,
    params,
    async all() {
      fake.executed.push(sql);
      return { success: true, results: db.prepare(sql).all(...(params as (string | number | null)[])).map((r) => ({ ...r })), meta: meta(0) };
    },
  });
  const binding = {
    prepare: (sql: string) => ({ bind: (...params: unknown[]) => bound(sql, params) }),
    async batch(stmts: ReturnType<typeof bound>[]) {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = stmts.map((s) => {
          fake.executed.push(s.sql);
          const r = db.prepare(s.sql).run(...(s.params as (string | number | null)[]));
          return { success: true, results: [], meta: meta(Number(r.changes)) };
        });
        db.exec('COMMIT');
        return out;
      } catch (e) {
        if (db.isTransaction) db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  fake.binding = binding as unknown as D1Database;
  return fake;
}

let h: SqliteDatabase;
let d1: FakeD1;
let now: number;
let state: StorageGuardState;
let log: ReturnType<typeof memoryLog>;
const clock = { now: () => now };
/** A Cloudflare store on the fake D1; every call shares `state`, like requests in one isolate. */
const store = () => createCloudflareStore({ DB: d1.binding }, log, { clock, guardState: state });
const errors = () => log.lines.filter((l) => l.level === 'error');
const DAY = '2026-11-01';
/** site_daily rows as plain objects, in key order. */
const rollup = () => h.db.prepare('SELECT * FROM site_daily ORDER BY day, kind, key, country').all().map((r) => ({ ...r }));

beforeEach(() => {
  h = openSqliteDatabase(':memory:');
  d1 = fakeD1(h.db);
  now = T0;
  state = createStorageGuardState();
  log = memoryLog();
});
afterEach(() => h.close());

describe('storage guard: thresholds', () => {
  test('below the limit everything is written and the last size is remembered', async () => {
    d1.size = 120 * MB;
    assert.equal((await store().applyBatch(write())).ok, true);
    assert.equal((await store().insertReport(reportRow(), pinned())).ok, true);
    assert.deepEqual(state, { sizeBytes: 120 * MB, blockedUntil: 0 });
    assert.deepEqual(errors(), []);
  });

  test('exactly at the limit is not over it', async () => {
    d1.size = STORAGE_LIMIT_BYTES;
    assert.equal((await store().applyBatch(write())).ok, true);
    assert.equal((await store().applyBatch(write())).ok, true);
    assert.equal(state.blockedUntil, 0);
  });

  test('the limit leaves 50 MB under the free plan’s 500 MB (CAPACITY.guardRatio) and the window is 10 minutes', () => {
    assert.equal(STORAGE_LIMIT_BYTES, 450 * MB);
    assert.equal(STORAGE_LIMIT_BYTES, CAPACITY.dbLimitBytes * CAPACITY.guardRatio);
    assert.equal(STORAGE_BLOCK_MS, 10 * 60_000);
  });

  test('results without a numeric size_after are ignored', () => {
    const g = createStorageGuard({ state, clock, log });
    for (const meta of [undefined, null, {}, { size_after: 'big' }, { size_after: Number.NaN }, { size_after: Number.POSITIVE_INFINITY }]) {
      g.observe(meta);
    }
    assert.deepEqual(state, { sizeBytes: null, blockedUntil: 0 });
    assert.equal(g.blocked(), false);
  });
});

describe('storage guard: blocking', () => {
  test('the write that sees the limit lands; then batches and reports are unavailable without touching D1, logged once', async () => {
    d1.size = 451 * MB;
    assert.deepEqual(await store().applyBatch(write()), { ok: true, value: { sessions: 1, events: 1, errors: 1 } });
    assert.equal(state.blockedUntil, T0 + STORAGE_BLOCK_MS);
    const executed = d1.executed.length;

    for (let i = 0; i < 3; i++) {
      now += 60_000;
      const b = await store().applyBatch(write({ events: [eventRow({ seq: 10 + i })] }));
      assert.deepEqual(b, { ok: false, error: { code: 'unavailable', message: 'storage is nearly full; retry later' } });
      const r = await store().insertReport(reportRow(), pinned());
      assert.equal(!r.ok && r.error.code, 'unavailable');
    }
    assert.equal(d1.executed.length, executed, 'refused calls send nothing to D1');
    assert.equal((h.db.prepare('SELECT count(*) AS n FROM reports').get() as { n: number }).n, 0);

    assert.equal(errors().length, 1);
    assert.equal(errors()[0]!.message, 'tce d1: database near its size limit; refusing new rows');
    assert.deepEqual(errors()[0]!.data, { sizeBytes: 451 * MB, limitBytes: STORAGE_LIMIT_BYTES, blockedForMs: STORAGE_BLOCK_MS });
  });

  test('forget, listExpired, deleteRows, deleteExpiredReports, countReportsSince, listSiteDaily and usage are never blocked', async () => {
    const s = store();
    await s.applyBatch(write({ events: [eventRow(), eventRow({ seq: 2, received: T0 - 200 * DAY_MS })] }));
    await s.insertReport(reportRow({ received: T0 - 100 * DAY_MS }), pinned());
    await s.writePagePoint(pagePoint({ day: DAY }));
    d1.size = 499 * MB;
    await s.countReportsSince(0); // a read that reports the size starts the window too
    assert.equal(state.blockedUntil, T0 + STORAGE_BLOCK_MS);
    assert.equal((await s.applyBatch(write())).ok, false);

    const expired = await s.listExpired('events', T0 - DAY_MS, 10);
    assert.ok(expired.ok);
    assert.equal(expired.value.length, 1);
    assert.deepEqual(await s.deleteRows('events', expired.value), { ok: true, value: 1 });
    assert.deepEqual(await s.countReportsSince(0), { ok: true, value: 1 });
    assert.deepEqual(await s.deleteExpiredReports(T0 - 90 * DAY_MS), { ok: true, value: 1 });
    assert.deepEqual(await s.listSiteDaily(DAY, DAY), { ok: true, value: [{ day: DAY, kind: 'view', key: '/', country: 'IN', count: 1 }] });
    const u = await s.usage();
    assert.ok(u.ok);
    assert.deepEqual([u.value.dbBytes, u.value.ingestPaused], [499 * MB, true]);
    const forgot = await s.forget(DEVICE_ID, VERIFIER);
    assert.deepEqual(forgot, { ok: true, value: { events: 1, errors: 1, reports: 0, sessions: 1, installs: 1, devices: 1 } });
    assert.equal(errors().length, 1, 'over-limit sizes seen inside the window do not log again');
    assert.equal(state.blockedUntil, T0 + STORAGE_BLOCK_MS, 'nor extend it');
  });

  test('after the window the next write measures again: still over starts a new window (logged again), under stays open', async () => {
    d1.size = 460 * MB;
    await store().applyBatch(write());
    now = T0 + STORAGE_BLOCK_MS - 1;
    assert.equal((await store().applyBatch(write())).ok, false, 'still inside the window');

    now = T0 + STORAGE_BLOCK_MS;
    assert.equal((await store().applyBatch(write({ events: [eventRow({ seq: 7 })] }))).ok, true, 'the re-check write lands');
    assert.equal(state.blockedUntil, T0 + 2 * STORAGE_BLOCK_MS);
    assert.equal(errors().length, 2);
    assert.equal((await store().insertReport(reportRow(), pinned())).ok, false);

    now = T0 + 2 * STORAGE_BLOCK_MS;
    d1.size = 300 * MB; // space was freed (retention, forget)
    assert.equal((await store().insertReport(reportRow(), pinned())).ok, true);
    assert.equal((await store().applyBatch(write())).ok, true);
    assert.equal(state.sizeBytes, 300 * MB);
    assert.equal(errors().length, 2);
  });

  test('the site_daily rollup is skipped while blocked: point writes answer ok, warn, send nothing to D1; AE still gets the point', async () => {
    const pageviews: AnalyticsEngineDataPoint[] = [];
    const PAGEVIEWS: AnalyticsEngineDataset = { writeDataPoint: (p) => void (p && pageviews.push(p)) };
    const s = () => createCloudflareStore({ DB: d1.binding, PAGEVIEWS }, log, { clock, guardState: state });
    d1.size = 451 * MB;
    assert.deepEqual(await s().writePagePoint(pagePoint({ day: DAY })), { ok: true, value: undefined }, 'the measuring write lands');
    assert.equal(state.blockedUntil, T0 + STORAGE_BLOCK_MS, 'a rollup write measures like any row-adding write');
    const executed = d1.executed.length;
    assert.deepEqual(await s().writePagePoint(pagePoint({ day: DAY })), { ok: true, value: undefined });
    assert.deepEqual(await s().writeDownloadPoint(downloadPoint({ day: DAY })), { ok: true, value: undefined });
    assert.equal(d1.executed.length, executed, 'no rollup statement reached D1');
    assert.deepEqual(rollup(), [{ day: DAY, kind: 'view', key: '/', country: 'IN', count: 1 }]);
    assert.equal(pageviews.length, 2, 'Analytics Engine is not D1 storage: both page views reached it');
    const warned = log.lines.filter((l) => l.level === 'warn').map((l) => l.message);
    assert.deepEqual(warned, [
      'tce sql store: writePagePoint rollup skipped; storage is nearly full',
      'tce sql store: writeDownloadPoint rollup skipped; storage is nearly full',
    ]);

    now = T0 + STORAGE_BLOCK_MS;
    d1.size = 200 * MB;
    assert.deepEqual(await s().writeDownloadPoint(downloadPoint({ day: DAY })), { ok: true, value: undefined });
    assert.deepEqual(rollup(), [
      { day: DAY, kind: 'download', key: 'lite', country: 'IN', count: 1 },
      { day: DAY, kind: 'view', key: '/', country: 'IN', count: 1 },
    ]);
  });

  test('usage probes D1 with one constant SELECT (then the oldest-row lookup), reports its size, and that size can start the window', async () => {
    d1.size = 120 * MB;
    assert.deepEqual(await store().usage(), { ok: true, value: { dbBytes: 120 * MB, ingestPaused: false, oldestReceived: NONE } });
    assert.deepEqual(d1.executed, [D1_SIZE_PROBE, OLDEST_RECEIVED]);
    assert.equal(state.sizeBytes, 120 * MB, 'the guard tracked the probe’s size');
    d1.size = 455 * MB;
    assert.deepEqual(await store().usage(), { ok: true, value: { dbBytes: 455 * MB, ingestPaused: true, oldestReceived: NONE } });
    assert.equal(state.blockedUntil, T0 + STORAGE_BLOCK_MS);
    assert.equal(errors().length, 1);
    assert.equal((await store().applyBatch(write())).ok, false, 'the window the probe started refuses batches');
  });

  test('usage reports null bytes when D1 omits size_after, and the guard state stays as it was', async () => {
    d1.size = undefined;
    assert.deepEqual(await store().usage(), { ok: true, value: { dbBytes: null, ingestPaused: false, oldestReceived: NONE } });
    assert.deepEqual(state, { sizeBytes: null, blockedUntil: 0 });
  });

  test('a refused ownership check is still forbidden, not masked, when the guard is open', async () => {
    d1.size = 10 * MB;
    await store().applyBatch(write());
    const r = await store().applyBatch(batchWrite({ device: deviceRow({ verifier: '0b'.repeat(32) }) }));
    assert.equal(!r.ok && r.error.code, 'forbidden');
  });

  test('stores built for separate requests share the isolate state by default', async () => {
    const saved = { ...ISOLATE_STORAGE_GUARD };
    try {
      d1.size = 470 * MB;
      const first = createCloudflareStore({ DB: d1.binding }, log, { clock });
      assert.equal((await first.applyBatch(write())).ok, true);
      const second = createCloudflareStore({ DB: d1.binding }, log, { clock });
      assert.equal(!((await second.insertReport(reportRow(), pinned())).ok), true, 'a later request in the same isolate is refused');
      assert.equal(ISOLATE_STORAGE_GUARD.blockedUntil, T0 + STORAGE_BLOCK_MS);
    } finally {
      Object.assign(ISOLATE_STORAGE_GUARD, saved);
    }
  });

  test('a custom limit applies (storageLimitBytes)', async () => {
    d1.size = 2 * MB;
    const s = createCloudflareStore({ DB: d1.binding }, log, { clock, guardState: state, storageLimitBytes: MB });
    assert.equal((await s.applyBatch(write())).ok, true);
    assert.equal((await s.applyBatch(write())).ok, false);
  });
});
