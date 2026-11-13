// The shared SQL store's usage() and its ingest gate (SqlStoreOptions
// .ingestPaused, what Cloudflare's D1 size guard plugs into): what is refused,
// what is skipped, and what always runs while the gate is closed.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { SqlDriver } from './driver.ts';
import { OLDEST_RECEIVED, createSqlStore } from './store.ts';
import { DAY_MS, DEVICE_ID, T0, batchWrite, downloadPoint, eventRow, pagePoint, reportRow } from '../../testkit/fixtures.ts';
import { V1, as, count, dev, freshDatabasePerTest, h, log, rec, store } from './store.test-support.ts';

freshDatabasePerTest();

const DAY = '2026-11-01';
/** oldestReceived of a store with no retained rows. */
const NONE = { events: null, errors: null, reports: null };

describe('usage', () => {
  test('reports the driver’s database size and an open gate by default', async () => {
    const r = await store().usage();
    assert.ok(r.ok);
    assert.equal(r.value.ingestPaused, false);
    assert.equal(typeof r.value.dbBytes, 'number');
    assert.ok(r.value.dbBytes! > 0);
    assert.equal(rec.sizes, 1);
    assert.equal(rec.batches.length, 0, 'measuring writes nothing');
  });

  test('the size grows as rows are added', async () => {
    const s = store();
    const before = await s.usage();
    const big = Array.from({ length: 200 }, (_, i) => eventRow({ seq: i, props: JSON.stringify({ k: 'v'.repeat(400) }) }));
    assert.equal((await s.applyBatch(as(V1, { events: big }))).ok, true);
    const after = await s.usage();
    assert.ok(before.ok && after.ok);
    assert.ok(after.value.dbBytes! > before.value.dbBytes!, `${after.value.dbBytes} > ${before.value.dbBytes}`);
  });

  test('a driver without dbBytes reports null; one whose dbBytes throws is unavailable, logged', async () => {
    const bare: SqlDriver = { batch: async () => [], all: async () => [] };
    assert.deepEqual(await createSqlStore(bare, {}, log).usage(), { ok: true, value: { dbBytes: null, ingestPaused: false, oldestReceived: NONE } });
    const failing: SqlDriver = {
      ...bare,
      async dbBytes() {
        throw new Error('D1_ERROR: network');
      },
    };
    const r = await createSqlStore(failing, {}, log).usage();
    assert.deepEqual(r, { ok: false, error: { code: 'unavailable', message: 'storage unavailable (usage); retry later' } });
    assert.match(String(log.entries.at(-1)?.data?.error), /D1_ERROR/);
  });

  test('ingestPaused is read after measuring, so a gate that learns from the measurement reports it at once', async () => {
    let closed = false;
    const measuring: SqlDriver = {
      batch: async () => [],
      all: async () => [],
      async dbBytes() {
        closed = true; // like D1: the probe's size_after closes the guard
        return 460_000_000;
      },
    };
    const r = await createSqlStore(measuring, {}, log, { ingestPaused: () => closed }).usage();
    assert.deepEqual(r, { ok: true, value: { dbBytes: 460_000_000, ingestPaused: true, oldestReceived: NONE } });
  });

  test('oldestReceived is the minimum received per retained table, each an index lookup', async () => {
    const s = store();
    assert.equal(
      (await s.applyBatch(as(V1, { events: [eventRow({ seq: 1, received: T0 + 50 }), eventRow({ seq: 2, received: T0 + 10 })] }))).ok,
      true,
    );
    assert.equal((await s.insertReport(reportRow({ received: T0 + 70 }), dev(V1))).ok, true);
    const r = await s.usage();
    assert.ok(r.ok);
    const errors = r.value.oldestReceived.errors;
    assert.deepEqual(r.value.oldestReceived, { events: T0 + 10, errors, reports: T0 + 70 });
    assert.equal(typeof errors, 'number', 'the fixture batch carries an error row');
    for (const plan of h.db.prepare(`EXPLAIN QUERY PLAN ${OLDEST_RECEIVED}`).all() as { detail: string }[]) {
      assert.doesNotMatch(plan.detail, /^SCAN (events|errors|reports)\b/, `full scan: ${plan.detail}`);
    }
  });
});

describe('ingest gate', () => {
  test('while closed: batches and reports are unavailable, rollups skipped (ok, warned), nothing reaches the driver', async () => {
    const pages: string[] = [];
    const s = store({ points: { page: (p) => pages.push(p.path), download() {} } }, { ingestPaused: () => true });
    const batch = await s.applyBatch(as(V1));
    assert.deepEqual(batch, { ok: false, error: { code: 'unavailable', message: 'storage is nearly full; retry later' } });
    const report = await s.insertReport(reportRow(), dev(V1));
    assert.deepEqual(report, { ok: false, error: { code: 'unavailable', message: 'storage is nearly full; retry later' } });
    assert.deepEqual(await s.writePagePoint(pagePoint({ day: DAY, path: '/install' })), { ok: true, value: undefined });
    assert.deepEqual(await s.writeDownloadPoint(downloadPoint({ day: DAY })), { ok: true, value: undefined });
    assert.deepEqual(rec.batches, []);
    assert.deepEqual(rec.reads, [], 'not even the ownership read');
    assert.equal(count(h.db, 'site_daily'), 0);
    assert.deepEqual(pages, ['/install'], 'the analytics sink is not storage: it still gets the point');
    const warned = log.entries.filter((e) => e.level === 'warn');
    assert.deepEqual(
      warned.map((e) => [e.message, e.data]),
      [
        ['tce sql store: writePagePoint rollup skipped; storage is nearly full', { op: 'writePagePoint', day: DAY, kind: 'view' }],
        ['tce sql store: writeDownloadPoint rollup skipped; storage is nearly full', { op: 'writeDownloadPoint', day: DAY, kind: 'download' }],
      ],
    );
    const u = await s.usage();
    assert.equal(u.ok && u.value.ingestPaused, true);
  });

  test('while closed: forget, retention scans and deletes, report counts and listSiteDaily still run', async () => {
    let closed = false;
    const s = store({}, { ingestPaused: () => closed });
    await s.applyBatch(as(V1, { events: [eventRow(), eventRow({ seq: 2, received: T0 - 200 * DAY_MS })] }));
    await s.insertReport(reportRow({ received: T0 - 100 * DAY_MS }), dev(V1));
    await s.writePagePoint(pagePoint({ day: DAY }));
    closed = true;
    const expired = await s.listExpired('events', T0 - DAY_MS, 10);
    assert.ok(expired.ok);
    assert.deepEqual(await s.deleteRows('events', expired.value), { ok: true, value: 1 });
    assert.deepEqual(await s.countReportsSince(0), { ok: true, value: 1 });
    assert.deepEqual(await s.deleteExpiredReports(T0 - 90 * DAY_MS), { ok: true, value: 1 });
    assert.deepEqual(await s.listSiteDaily(DAY, DAY), { ok: true, value: [{ day: DAY, kind: 'view', key: '/', country: 'IN', count: 1 }] });
    assert.deepEqual(await s.forget(DEVICE_ID, V1), {
      ok: true,
      value: { events: 1, errors: 1, reports: 0, share_daily: 0, share_installs: 0, share_links: 0, sessions: 1, installs: 1, devices: 1 },
    });
  });

  test('the gate is asked per call: reopening it lets writes through again', async () => {
    let closed = true;
    const s = store({}, { ingestPaused: () => closed });
    assert.equal((await s.applyBatch(batchWrite())).ok, false);
    closed = false;
    assert.equal((await s.applyBatch(batchWrite())).ok, true);
    assert.deepEqual(await s.writePagePoint(pagePoint({ day: DAY })), { ok: true, value: undefined });
    assert.equal(count(h.db, 'site_daily'), 1);
  });
});
