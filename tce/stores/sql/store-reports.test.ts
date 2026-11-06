// The shared SQL store's reports and GitHub counters, run through the
// node:sqlite driver: report retention, insertReport's ownership guard and
// device upsert (including a concurrent writer), and the counter upserts.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { SqlDriver, SqlStatement } from './driver.ts';
import { createSqlStore } from './store.ts';
import {
  DAY_MS,
  DEVICE_ID,
  DEVICE_ID_2,
  DRM_ID,
  REPORT_ID_2,
  T0,
  githubAssetRow,
  githubRepoRow,
  reportRow,
} from '../../testkit/fixtures.ts';
import { V1, V2, V_BAD, as, count, counts, dev, freshDatabasePerTest, h, log, rec, row, store } from './store.test-support.ts';

freshDatabasePerTest();

describe('report retention', () => {
  const reports = [
    reportRow({ received: T0 - 2 * DAY_MS }),
    reportRow({ report_id: REPORT_ID_2, received: T0 - DAY_MS }),
    reportRow({ report_id: 'r-3', received: T0 }),
    reportRow({ report_id: 'r-4', received: T0 + 1 }),
  ];

  test('countReportsSince counts received >= the bound', async () => {
    const s = store();
    assert.deepEqual(await s.countReportsSince(T0), { ok: true, value: 0 });
    for (const r of reports) await s.insertReport(r, dev(V1));
    assert.deepEqual(await s.countReportsSince(T0), { ok: true, value: 2 }, 'inclusive');
    assert.deepEqual(await s.countReportsSince(T0 + 1), { ok: true, value: 1 });
    assert.deepEqual(await s.countReportsSince(T0 - 3 * DAY_MS), { ok: true, value: 4 });
    assert.deepEqual(await s.countReportsSince(T0 + 2), { ok: true, value: 0 });
    assert.equal(rec.batches.length, reports.length, 'counting writes nothing');
  });

  test('deleteExpiredReports deletes received < the bound and returns how many', async () => {
    const s = store();
    for (const r of reports) await s.insertReport(r, dev(V1));
    assert.deepEqual(await s.deleteExpiredReports(T0 - DAY_MS), { ok: true, value: 1 }, 'exclusive');
    assert.deepEqual(await s.deleteExpiredReports(T0 + 1), { ok: true, value: 2 });
    assert.deepEqual(await s.deleteExpiredReports(T0 + 1), { ok: true, value: 0 });
    assert.deepEqual(
      (h.db.prepare('SELECT report_id FROM reports').all() as { report_id: string }[]).map((r) => r.report_id),
      ['r-4'],
    );
  });

  test('a bound that is not a finite number is bad_request and reaches no SQL', async () => {
    const s = store();
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '1' as unknown as number, null as unknown as number]) {
      const c = await s.countReportsSince(bad);
      assert.equal(!c.ok && c.error.code, 'bad_request');
      const d = await s.deleteExpiredReports(bad);
      assert.equal(!d.ok && d.error.code, 'bad_request');
    }
    assert.equal(rec.reads.length + rec.batches.length, 0);
  });
});

describe('insertReport ownership and the device upsert', () => {
  const reports = () => h.db.prepare('SELECT report_id FROM reports').all().map((r) => (r as { report_id: string }).report_id);
  const device = () => row(h.db, 'SELECT * FROM devices WHERE device_id = ?', DEVICE_ID);
  const tables = ['devices', 'installs', 'sessions', 'events', 'errors', 'reports'] as const;
  const snapshot = () => Object.fromEntries(tables.map((t) => [t, h.db.prepare(`SELECT * FROM ${t}`).all().map((r) => ({ ...r }))]));

  test('from a device with no row yet: one read, then one atomic batch that creates the device pinned to the verifier and the report', async () => {
    const s = store();
    assert.deepEqual(await s.insertReport(reportRow(), dev(V1)), { ok: true, value: { inserted: true } });
    assert.equal(rec.reads.length, 1, 'one ownership read');
    assert.deepEqual(rec.reads[0]!.params, [DEVICE_ID]);
    assert.equal(rec.batches.length, 1, 'one write batch');
    assert.deepEqual(
      rec.batches[0]!.map((st) => st.sql.match(/^INSERT INTO (\w+)/)?.[1]),
      ['devices', 'reports'],
    );
    assert.deepEqual(device(), { ...dev(V1) });
    assert.deepEqual(reports(), [reportRow().report_id]);
    // The pinned device: a batch with the same verifier merges, forget finds the report.
    assert.equal((await s.applyBatch(as(V1, {}, { last_seen: T0 + 1 }))).ok, true);
    assert.deepEqual(await s.forget(DEVICE_ID, V1), { ok: true, value: counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1, reports: 1 }) });
  });

  test('the device upsert is the applyBatch one: merge rules and the first verifier kept', async () => {
    const s = store();
    await s.applyBatch(as(V1));
    const r = await s.insertReport(reportRow(), dev(V1, { model: 'Pixel 9', drm_id: DRM_ID, last_seen: T0 + 10, first_seen: T0 + 10 }));
    assert.deepEqual(r, { ok: true, value: { inserted: true } });
    assert.deepEqual([device().model, device().drm_id, device().first_seen, device().last_seen, device().verifier], ['Pixel 9', DRM_ID, T0, T0 + 10, V1]);
    // An older report merges like an older batch: nothing but first_seen moves.
    await s.insertReport(reportRow({ report_id: REPORT_ID_2 }), dev(V1, { model: 'older', first_seen: T0 - 10, last_seen: T0 - 10 }));
    assert.deepEqual([device().model, device().first_seen, device().last_seen], ['Pixel 9', T0 - 10, T0 + 10]);
  });

  test('forbidden with nothing written when the device is pinned to another verifier (or the verifier is missing)', async () => {
    const s = store();
    await s.applyBatch(as(V1));
    const before = snapshot();
    const batchesBefore = rec.batches.length;
    for (const v of [V_BAD, '', null]) {
      const r = await s.insertReport(reportRow({ note: 'impostor' }), dev(v, { model: 'Impostor', last_seen: T0 + DAY_MS }));
      assert.equal(!r.ok && r.error.code, 'forbidden', String(v));
    }
    assert.equal(rec.batches.length, batchesBefore, 'no write batch was even sent');
    assert.deepEqual(snapshot(), before);
    assert.equal(log.entries.length, 0);
  });

  test('a device from before migration 0002 (null verifier) is pinned by the report; a replayed id stays inserted: false', async () => {
    const s = store();
    await s.applyBatch(as(null));
    assert.deepEqual(await s.insertReport(reportRow(), dev(V1)), { ok: true, value: { inserted: true } });
    assert.equal(device().verifier, V1);
    assert.deepEqual(await s.insertReport(reportRow(), dev(V1)), { ok: true, value: { inserted: false } });
    const other = await s.insertReport(reportRow({ report_id: REPORT_ID_2 }), dev(V2));
    assert.equal(!other.ok && other.error.code, 'forbidden');
    assert.deepEqual(reports(), [reportRow().report_id]);
  });

  test('a verifier pinned by a concurrent writer after the check aborts the whole batch (forbidden, nothing written)', async () => {
    let armed = true;
    const racing: SqlDriver = {
      batch: (stmts) => h.driver.batch(stmts),
      async all<T>(sql: string, params: SqlStatement['params']) {
        const rows = await h.driver.all<T>(sql, params);
        if (armed) {
          armed = false;
          await h.driver.batch([
            {
              sql: `INSERT INTO devices (device_id, verifier, hw_hash, manufacturer, model, sdk_int, abi, ram_gb, locale, tester, first_seen, last_seen)
                    VALUES (?, ?, 'h', 'm', 'Racer', 36, 'a', 8, 'en', 0, ?, ?)`,
              params: [DEVICE_ID, V2, T0, T0],
            },
          ]);
        }
        return rows;
      },
    };
    const r = await createSqlStore(racing, {}, log).insertReport(reportRow(), dev(V1, { model: 'Mine', last_seen: T0 + 1 }));
    assert.equal(!r.ok && r.error.code, 'forbidden');
    assert.equal(armed, false);
    assert.deepEqual(reports(), []);
    assert.deepEqual([device().verifier, device().model], [V2, 'Racer'], 'the racer keeps its row');
    assert.equal(h.db.isTransaction, false);
    assert.equal(log.entries.length, 0, 'a refusal is an answer, not a storage failure');
  });

  test('a failing report statement rolls back the device upsert too', async () => {
    const r = await store().insertReport(reportRow({ version: null as unknown as string }), dev(V1));
    assert.equal(!r.ok && r.error.code, 'unavailable');
    assert.equal(count(h.db, 'devices'), 0);
    assert.equal(count(h.db, 'reports'), 0);
    assert.equal(log.entries.length, 1);
    assert.match(String(log.entries[0]!.data?.error), /NOT NULL/);
  });

  test('a report row naming another device than its device row is refused before any SQL (an op bug)', async () => {
    const r = await store().insertReport(reportRow({ device_id: DEVICE_ID_2 }), dev(V1));
    assert.deepEqual(!r.ok && [r.error.code, r.error.field], ['internal', 'device_id']);
    assert.equal(rec.reads.length + rec.batches.length, 0);
  });

  test('the report statement is one INSERT ... SELECT with the guard and the conflict clause, after the device upsert', async () => {
    await store().insertReport(reportRow(), dev(V1));
    const [upsert, stmt] = rec.batches[0]!;
    assert.match(upsert!.sql, /^INSERT INTO devices \(device_id, verifier, .*\) VALUES \(.*\) ON CONFLICT \(device_id\) DO UPDATE SET hw_hash = CASE WHEN devices\.verifier IS NOT NULL AND devices\.verifier IS NOT excluded\.verifier THEN NULL/);
    assert.match(stmt!.sql, /^INSERT INTO reports \(report_id, .*\) SELECT \?(, \?){10} WHERE NOT EXISTS \(SELECT 1 FROM devices WHERE device_id = \? AND verifier IS NOT NULL AND verifier IS NOT \?\) ON CONFLICT \(report_id\) DO NOTHING$/);
    assert.deepEqual(stmt!.params.slice(-2), [DEVICE_ID, V1]);
    const p = (h.db.prepare(`EXPLAIN QUERY PLAN ${stmt!.sql}`).all(...(stmt!.params as (string | number | null)[])) as { detail: string }[])
      .map((r) => r.detail)
      .join(' | ');
    assert.match(p, /SEARCH devices USING PRIMARY KEY \(device_id=\?\)/);
    assert.doesNotMatch(p, /\bSCAN devices\b/);
  });
});

describe('reports and GitHub counters', () => {
  test('insertReport is insert-or-ignore on report_id', async () => {
    const s = store();
    assert.deepEqual(await s.insertReport(reportRow(), dev(V1)), { ok: true, value: { inserted: true } });
    assert.deepEqual(await s.insertReport(reportRow({ note: 'changed' }), dev(V1)), { ok: true, value: { inserted: false } });
    assert.deepEqual(row(h.db, 'SELECT * FROM reports'), { ...reportRow() });
  });

  test('a 40 KB report (multi-byte log tail) is stored intact', async () => {
    const logTail = '日志'.repeat(5_000); // 30,000 bytes
    assert.deepEqual(await store().insertReport(reportRow({ log_tail: logTail }), dev(V1)), { ok: true, value: { inserted: true } });
    assert.equal(row(h.db, 'SELECT log_tail FROM reports').log_tail, logTail);
  });

  test('upsertGithubDaily replaces the day counters in one batch', async () => {
    const s = store();
    const assets = Array.from({ length: 30 }, (_, i) => githubAssetRow({ asset: `a${i}.apk`, download_count: i }));
    assert.deepEqual(await s.upsertGithubDaily(assets, githubRepoRow()), { ok: true, value: undefined });
    assert.equal(rec.batches.length, 1);
    assert.deepEqual(
      rec.batches[0]!.map((st) => st.params.length),
      [100, 20, 9],
    );
    await s.upsertGithubDaily(
      [githubAssetRow({ asset: 'a0.apk', download_count: 50 })],
      githubRepoRow({ stars: 13, views: 40, view_uniques: 5, referrers: '[]' }),
    );
    assert.equal(count(h.db, 'github_assets_daily'), 30);
    assert.equal(row(h.db, "SELECT download_count FROM github_assets_daily WHERE asset = 'a0.apk'").download_count, 50);
    assert.deepEqual(row(h.db, 'SELECT * FROM github_repo_daily'), {
      ...githubRepoRow({ stars: 13, views: 40, view_uniques: 5, referrers: '[]' }),
    });
    await s.upsertGithubDaily([], null);
    assert.equal(rec.batches.length, 2, 'nothing to write, no batch');
  });
});
