// The Cloudflare store against wrangler's local emulation (local-d1.test-support.ts:
// workerd + local D1, no account): testkit's Store contract, every shared
// migration, D1 limits, batch atomicity and ownership on a real D1, and the
// storage guard's wiring to D1's size_after. store-site.test.ts covers points,
// the site_daily rollup and usage() on the same emulation; guard.test.ts
// covers the guard's thresholds with a fake D1.

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { TableName } from '../../core/schema/rows.ts';
import { STATEMENT_LIMITS, statementBytes } from '../sql/chunk.ts';
import { storeContract } from '../../testkit/contract/index.ts';
import type { MakeOptions, StoreUnderTest } from '../../testkit/contract/index.ts';
import {
  DAY_MS,
  DEVICE_ID,
  DEVICE_ID_2,
  INSTALL_ID_3,
  REPORT_ID_2,
  SESSION_ID,
  T0,
  batchWrite,
  deviceRow,
  errorRow,
  eventRow,
  reportRow,
  sessionRow,
} from '../../testkit/fixtures.ts';
import { createStorageGuardState } from './guard.ts';
import { createCloudflareStore } from './store.ts';
import type { CloudflareStoreEnv } from './store.ts';
import { DB, MIGRATIONS, TABLES, V1, V2, count, failingDataset, memoryLog, recordingDataset, reset } from './local-d1.test-support.ts';

/** Compile-time: the store binds no R2 bucket any more (cold storage was removed). */
const noArchiveBinding: 'ARCHIVE' extends keyof CloudflareStoreEnv ? never : true = true;

storeContract(
  'cloudflare (local D1)',
  async (opts: MakeOptions = {}): Promise<StoreUnderTest> => {
    await reset();
    const env: CloudflareStoreEnv = {
      DB,
      PAGEVIEWS: opts.failingPointSink ? failingDataset() : recordingDataset(),
      DOWNLOADS: opts.failingPointSink ? failingDataset() : recordingDataset(),
    };
    return {
      // A fresh guard state per case, so a case that fills the guard cannot leak into the next.
      store: createCloudflareStore(env, memoryLog(), { guardState: createStorageGuardState() }),
      dump: async (table: TableName) => (await DB.prepare(`SELECT * FROM ${table}`).all<object>()).results,
    };
  },
  { pointSinkFailure: true },
);

describe('cloudflare: D1 specifics', () => {
  beforeEach(reset);

  test('the store env has no ARCHIVE binding', () => {
    assert.equal(noArchiveBinding, true);
  });

  test('the schema applied to local D1 has every table', async () => {
    const { results } = await DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name").all<{
      name: string;
    }>();
    assert.deepEqual(
      results.map((r) => r.name),
      [...TABLES].sort(),
    );
  });

  test('migrations 0001, 0002 and 0003 were applied in order: devices.verifier, the ownership indexes, site_daily', async () => {
    assert.deepEqual(
      MIGRATIONS.map((m) => m.name).slice(0, 3),
      ['0001_init.sql', '0002_ownership_indexes.sql', '0003_site_daily.sql'],
    );
    const site = await DB.prepare('PRAGMA table_info(site_daily)').all<{ name: string; pk: number }>();
    assert.deepEqual(
      site.results.map((c) => [c.name, c.pk]),
      [
        ['day', 1],
        ['kind', 2],
        ['key', 3],
        ['country', 4],
        ['count', 0],
      ],
    );
    const cols = await DB.prepare('PRAGMA table_info(devices)').all<{ name: string }>();
    assert.ok(cols.results.some((c) => c.name === 'verifier'));
    const { results } = await DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('errors_device', 'reports_device', 'reports_received') ORDER BY name",
    ).all<{ name: string }>();
    assert.deepEqual(
      results.map((r) => r.name),
      ['errors_device', 'reports_device', 'reports_received'],
    );
  });

  test('local D1 enforces the 100-parameter cap that the store chunks for', async () => {
    const insert = (n: number) => `INSERT INTO github_assets_daily (day, tag, asset, download_count) VALUES ${Array(n / 4).fill('(?, ?, ?, ?)').join(', ')}`;
    const params = (n: number) => Array.from({ length: n / 4 }, (_, i) => ['2026-11-01', 'v1', `a${i}`, i]).flat();
    await DB.prepare(insert(100)).bind(...params(100)).run();
    await assert.rejects(DB.prepare(insert(104)).bind(...params(104)).run(), /too many SQL variables/);
  });

  test('a maximal batch (20 sessions, 500 events, 50 errors) lands in one atomic D1 batch', async () => {
    const statements: { sql: string; params: number }[] = [];
    const spy = new Proxy(DB, {
      get(target, prop, receiver) {
        if (prop === 'batch') {
          return (stmts: D1PreparedStatement[]) => target.batch(stmts);
        }
        if (prop === 'prepare') {
          return (sql: string) => {
            const stmt = target.prepare(sql);
            return new Proxy(stmt, {
              get(s, p, r) {
                if (p === 'bind') {
                  return (...values: unknown[]) => {
                    statements.push({ sql, params: values.length });
                    return s.bind(...values);
                  };
                }
                const v = Reflect.get(s, p, r);
                return typeof v === 'function' ? v.bind(s) : v;
              },
            });
          };
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    });
    const store = createCloudflareStore({ DB: spy }, memoryLog());
    const sessions = Array.from({ length: 20 }, (_, i) => sessionRow({ session_id: `s${i}` }));
    const events = Array.from({ length: 500 }, (_, i) => eventRow({ session_id: `s${i % 20}`, seq: i, props: JSON.stringify({ k: 'v'.repeat(400) }) }));
    const errors = Array.from({ length: 50 }, (_, i) => errorRow({ error_id: `e${i}`, frames: JSON.stringify(Array(5).fill('f'.repeat(200))) }));
    const write = batchWrite({ sessions, events, errors });
    assert.deepEqual(await store.applyBatch(write), { ok: true, value: { sessions: 20, events: 500, errors: 50 } });
    // One ownership read (the device id + 20 session ids), then the 60-statement write batch.
    assert.equal(statements.length, 61);
    assert.match(statements[0]!.sql, /^SELECT 'device' AS kind/);
    assert.equal(statements[0]!.params, 21);
    assert.equal(statements.filter((s) => s.sql.startsWith('INSERT INTO ')).length, 60);
    assert.ok(statements.every((s) => s.params <= STATEMENT_LIMITS.maxParams));
    assert.equal(await count('events'), 500);
    assert.equal(await count('errors'), 50);
    assert.equal(await count('sessions'), 20);
    assert.deepEqual(await store.applyBatch(write), { ok: true, value: { sessions: 20, events: 0, errors: 0 } });
    assert.equal(await count('events'), 500);
  });

  test('a failing statement late in the batch rolls back everything before it', async () => {
    const log = memoryLog();
    const store = createCloudflareStore({ DB }, log);
    const events = Array.from({ length: 40 }, (_, i) => eventRow({ seq: i }));
    const bad = errorRow({ class_name: null as unknown as string });
    const r = await store.applyBatch(batchWrite({ events, errors: [bad] }));
    assert.equal(!r.ok && r.error.code, 'unavailable');
    for (const t of ['devices', 'installs', 'sessions', 'events', 'errors']) assert.equal(await count(t), 0, t);
    assert.equal(log.errors.length, 1);
    assert.match(log.errors[0]!, /NOT NULL/);
  });

  test('merge rules hold on D1 (sessions: newest non-null by received)', async () => {
    const store = createCloudflareStore({ DB }, memoryLog());
    await store.applyBatch(batchWrite({ sessions: [sessionRow({ boot_ms: 1800, ended: null, counters: '{"a":1}', received: T0 })] }));
    await store.applyBatch(batchWrite({ sessions: [sessionRow({ boot_ms: null, ended: T0 + 9, counters: '{"a":2}', received: T0 + 1 })] }));
    await store.applyBatch(batchWrite({ sessions: [sessionRow({ boot_ms: 1, ended: T0 + 5, counters: '{"old":1}', received: T0 - 1 })] }));
    const row = await DB.prepare('SELECT boot_ms, ended, counters, received FROM sessions WHERE session_id = ?').bind(SESSION_ID).first();
    assert.deepEqual(row, { boot_ms: 1800, ended: T0 + 9, counters: '{"a":2}', received: T0 + 1 });
  });

  test('deleteRows with composite keys (row-value IN) works on D1, chunked', async () => {
    const store = createCloudflareStore({ DB }, memoryLog());
    const events = Array.from({ length: 120 }, (_, i) => eventRow({ seq: i, received: T0 + i }));
    await store.applyBatch(batchWrite({ events, errors: [] }));
    const listed = await store.listExpired('events', T0 + 1000, 1000);
    assert.ok(listed.ok);
    assert.deepEqual(listed.value, events);
    assert.deepEqual(await store.deleteRows('events', listed.value.slice(0, 110)), { ok: true, value: 110 });
    assert.equal(await count('events'), 10);
  });

  test('a 40 KB report fits one D1 statement', async () => {
    const store = createCloudflareStore({ DB }, memoryLog());
    const row = reportRow({ log_tail: '日志'.repeat(5_000), events: JSON.stringify(Array(200).fill({ n: 'x' })) });
    assert.ok(statementBytes({ sql: '', params: [row.log_tail, row.events] }) < STATEMENT_LIMITS.maxBytes);
    assert.deepEqual(await store.insertReport(row, deviceRow({ verifier: V1 })), { ok: true, value: { inserted: true } });
    assert.equal(await DB.prepare('SELECT log_tail FROM reports').first('log_tail'), row.log_tail);
  });

  test('forget on D1 needs the pinned verifier and returns per-table counts', async () => {
    const store = createCloudflareStore({ DB }, memoryLog());
    await store.applyBatch(batchWrite({ device: deviceRow({ verifier: V1 }), events: [eventRow(), eventRow({ seq: 2 })] }));
    await store.insertReport(reportRow(), deviceRow({ verifier: V1 }));
    const wrong = await store.forget(DEVICE_ID, V2);
    assert.equal(!wrong.ok && wrong.error.code, 'not_found');
    assert.equal(await count('events'), 2);
    assert.deepEqual(await store.forget(DEVICE_ID, V1), {
      ok: true,
      value: { events: 2, errors: 1, reports: 1, sessions: 1, installs: 1, devices: 1 },
    });
  });

  test('ownership on D1: the verifier is pinned; another one and a foreign session are forbidden with nothing written', async () => {
    const store = createCloudflareStore({ DB }, memoryLog());
    assert.equal((await store.applyBatch(batchWrite({ device: deviceRow({ verifier: V1 }) }))).ok, true);
    const impostor = await store.applyBatch(batchWrite({ device: deviceRow({ verifier: V2, model: 'Impostor' }), events: [eventRow({ seq: 5 })] }));
    assert.equal(!impostor.ok && impostor.error.code, 'forbidden');
    const other = { device_id: DEVICE_ID_2, install_id: INSTALL_ID_3 };
    const foreign = await store.applyBatch(
      batchWrite({
        device: deviceRow({ device_id: DEVICE_ID_2, verifier: V2 }),
        install: { ...batchWrite().install, ...other },
        sessions: [sessionRow(other)],
        events: [eventRow({ ...other, seq: 6 })],
        errors: [],
      }),
    );
    assert.equal(!foreign.ok && foreign.error.code, 'forbidden');
    assert.deepEqual((await DB.prepare('SELECT device_id, verifier, model FROM devices').all()).results, [
      { device_id: DEVICE_ID, verifier: V1, model: 'Pixel 8' },
    ]);
    assert.equal(await count('events'), 1);
    assert.equal(await count('installs'), 1);
    // Reports follow the pinned verifier too (D1 runs the guarded device upsert, then the guarded INSERT ... SELECT ... ON CONFLICT).
    const report = await store.insertReport(reportRow(), deviceRow({ verifier: V2, model: 'Impostor' }));
    assert.equal(!report.ok && report.error.code, 'forbidden');
    assert.equal(await count('reports'), 0);
    assert.equal(await DB.prepare('SELECT model FROM devices').first('model'), 'Pixel 8');
    assert.deepEqual(await store.insertReport(reportRow(), deviceRow({ verifier: V1 })), { ok: true, value: { inserted: true } });
    assert.deepEqual(await store.insertReport(reportRow(), deviceRow({ verifier: V1 })), { ok: true, value: { inserted: false } });
  });

  test('a report from a never-seen phone pins its device on D1 in one atomic batch; forget with the proof deletes it', async () => {
    const store = createCloudflareStore({ DB }, memoryLog());
    const device = deviceRow({ device_id: DEVICE_ID_2, verifier: V2 });
    const report = reportRow({ device_id: DEVICE_ID_2, install_id: INSTALL_ID_3 });
    assert.deepEqual(await store.insertReport(report, device), { ok: true, value: { inserted: true } });
    assert.deepEqual((await DB.prepare('SELECT device_id, verifier FROM devices').all()).results, [{ device_id: DEVICE_ID_2, verifier: V2 }]);
    const stranger = await store.insertReport(reportRow({ ...report, report_id: REPORT_ID_2 }), deviceRow({ device_id: DEVICE_ID_2, verifier: V1 }));
    assert.equal(!stranger.ok && stranger.error.code, 'forbidden');
    assert.equal(await count('reports'), 1);
    assert.deepEqual(await store.forget(DEVICE_ID_2, V2), {
      ok: true,
      value: { events: 0, errors: 0, reports: 1, sessions: 0, installs: 0, devices: 1 },
    });
    assert.equal(await count('reports'), 0);
    assert.equal(await count('devices'), 0);
  });

  test('a failing report statement rolls back the device upsert on D1', async () => {
    const log = memoryLog();
    const r = await createCloudflareStore({ DB }, log).insertReport(reportRow({ version: null as unknown as string }), deviceRow({ verifier: V1 }));
    assert.equal(!r.ok && r.error.code, 'unavailable');
    assert.equal(await count('devices'), 0);
    assert.equal(await count('reports'), 0);
    assert.match(log.errors[0] ?? '', /NOT NULL/);
  });

  test('a device row from before 0002 (null verifier) is filled by the next batch on D1', async () => {
    await DB.prepare(
      `INSERT INTO devices (device_id, hw_hash, manufacturer, model, sdk_int, abi, ram_gb, locale, tester, first_seen, last_seen)
       VALUES (?, 'h', 'Google', 'Pixel 8', 36, 'arm64-v8a', 8, 'en-IN', 0, ?, ?)`,
    )
      .bind(DEVICE_ID, T0, T0)
      .run();
    const store = createCloudflareStore({ DB }, memoryLog());
    assert.equal((await store.applyBatch(batchWrite({ device: deviceRow({ verifier: V1 }) }))).ok, true);
    assert.equal(await DB.prepare('SELECT verifier FROM devices').first('verifier'), V1);
  });

  test('a verifier pinned by a racing request between the check and the batch aborts the D1 batch (forbidden)', async () => {
    let armed = true;
    /** Forward every property of `target`, binding methods to it. */
    const forward = <T extends object>(target: T, prop: string | symbol): unknown => {
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    };
    // A DB whose first read lets another "request" claim the device before the store's write batch.
    const racing = new Proxy(DB, {
      get(db, prop) {
        if (prop !== 'prepare') return forward(db, prop);
        return (sql: string) =>
          new Proxy(db.prepare(sql), {
            get(stmt, p) {
              if (p !== 'bind') return forward(stmt, p);
              return (...values: unknown[]) =>
                new Proxy(stmt.bind(...values), {
                  get(bound, q) {
                    if (q !== 'all' || !armed) return forward(bound, q);
                    return async () => {
                      armed = false;
                      const out = await bound.all();
                      await db
                        .prepare(
                          `INSERT INTO devices (device_id, verifier, hw_hash, manufacturer, model, sdk_int, abi, ram_gb, locale, tester, first_seen, last_seen)
                           VALUES (?, ?, 'h', 'm', 'Racer', 36, 'a', 8, 'en', 0, ?, ?)`,
                        )
                        .bind(DEVICE_ID, V2, T0, T0)
                        .run();
                      return out;
                    };
                  },
                });
            },
          });
      },
    });
    const log = memoryLog();
    const r = await createCloudflareStore({ DB: racing }, log).applyBatch(batchWrite({ device: deviceRow({ verifier: V1 }) }));
    assert.equal(!r.ok && r.error.code, 'forbidden');
    assert.equal(armed, false, 'the race was staged');
    assert.equal(await DB.prepare('SELECT model FROM devices').first('model'), 'Racer');
    for (const t of ['installs', 'sessions', 'events', 'errors']) assert.equal(await count(t), 0, t);
    assert.deepEqual(log.errors, []);
  });

  test('countReportsSince and deleteExpiredReports on D1', async () => {
    const store = createCloudflareStore({ DB }, memoryLog());
    await store.insertReport(reportRow({ received: T0 - 100 * DAY_MS }), deviceRow({ verifier: V1 }));
    await store.insertReport(reportRow({ report_id: REPORT_ID_2, received: T0 }), deviceRow({ verifier: V1 }));
    assert.deepEqual(await store.countReportsSince(T0), { ok: true, value: 1 });
    assert.deepEqual(await store.countReportsSince(0), { ok: true, value: 2 });
    assert.deepEqual(await store.deleteExpiredReports(T0 - 90 * DAY_MS), { ok: true, value: 1 });
    assert.deepEqual(await store.countReportsSince(0), { ok: true, value: 1 });
  });

  test('the storage guard reads size_after from real local D1 results', async () => {
    const state = createStorageGuardState();
    const store = createCloudflareStore({ DB }, memoryLog(), { guardState: state });
    assert.equal((await store.applyBatch(batchWrite({ device: deviceRow({ verifier: V1 }) }))).ok, true);
    assert.equal(typeof state.sizeBytes, 'number');
    assert.ok(state.sizeBytes! > 0 && state.sizeBytes! < 100_000_000, String(state.sizeBytes));
    assert.equal(state.blockedUntil, 0);
    // The same database over a 1-byte limit: the write that measures lands, the next is refused, forget still runs.
    const capped = createCloudflareStore({ DB }, memoryLog(), { guardState: createStorageGuardState(), storageLimitBytes: 1 });
    assert.equal((await capped.insertReport(reportRow(), deviceRow({ verifier: V1 }))).ok, true);
    const refused = await capped.applyBatch(batchWrite({ device: deviceRow({ verifier: V1 }) }));
    assert.equal(!refused.ok && refused.error.code, 'unavailable');
    assert.equal((await capped.forget(DEVICE_ID, V1)).ok, true);
  });
});
