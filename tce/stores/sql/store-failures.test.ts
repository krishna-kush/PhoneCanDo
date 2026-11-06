// The shared SQL store's failure mapping: a throwing or short driver makes
// every call `unavailable` (details only in the log), and a statement failing
// mid-batch rolls the whole batch back.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { SqlDriver } from './driver.ts';
import { createSqlStore } from './store.ts';
import { DEVICE_ID, T0, batchWrite, downloadPoint, eventRow, githubAssetRow, pagePoint, reportRow } from '../../testkit/fixtures.ts';
import { V1, count, dev, freshDatabasePerTest, h, log, store } from './store.test-support.ts';

freshDatabasePerTest();

describe('driver failures', () => {
  const broken: SqlDriver = {
    async batch() {
      throw new Error('D1_ERROR: database is locked');
    },
    async all() {
      throw new Error('D1_ERROR: network');
    },
    async dbBytes() {
      throw new Error('D1_ERROR: size probe failed');
    },
  };

  test('every call returns unavailable and logs; none throws', async () => {
    const s = createSqlStore(broken, {}, log);
    const results = [
      await s.applyBatch(batchWrite()),
      await s.insertReport(reportRow(), dev(V1)),
      await s.countReportsSince(T0),
      await s.deleteExpiredReports(T0),
      await s.forget(DEVICE_ID, V1),
      await s.upsertGithubDaily([githubAssetRow()], null),
      await s.listExpired('events', T0, 10),
      await s.deleteRows('events', [eventRow()]),
      await s.writePagePoint(pagePoint({ day: '2026-11-01' })),
      await s.writeDownloadPoint(downloadPoint({ day: '2026-11-01' })),
      await s.listSiteDaily('2026-11-01', '2026-11-30'),
      await s.usage(),
    ];
    for (const r of results) {
      assert.equal(r.ok, false);
      assert.equal(!r.ok && r.error.code, 'unavailable');
      assert.ok(!r.ok && !r.error.message.includes('D1_ERROR'), 'driver details stay in the log');
    }
    assert.equal(log.entries.length, results.length);
    assert.ok(log.entries.every((e) => e.level === 'error' && /D1_ERROR/.test(String(e.data?.error))));
  });

  test('a driver that returns the wrong number of results is unavailable', async () => {
    const short: SqlDriver = { batch: async () => [{ changes: 1 }], all: async () => [] };
    const r = await createSqlStore(short, {}, log).applyBatch(batchWrite());
    assert.equal(!r.ok && r.error.code, 'unavailable');
  });

  test('a statement failing mid-batch rolls the whole batch back', async () => {
    const s = store();
    const bad = eventRow({ seq: 2, name: null as unknown as string }); // NOT NULL violation
    const r = await s.applyBatch(batchWrite({ events: [eventRow(), bad] }));
    assert.equal(!r.ok && r.error.code, 'unavailable');
    for (const t of ['devices', 'installs', 'sessions', 'events', 'errors']) assert.equal(count(h.db, t), 0, t);
    assert.equal(h.db.isTransaction, false);
    assert.equal((await s.applyBatch(batchWrite())).ok, true, 'the store keeps working');
  });
});
