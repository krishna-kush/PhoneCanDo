import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { storeContract } from '../../testkit/contract/index.ts';
import { batchWrite, deviceRow, DEVICE_ID_2, downloadPoint, eventRow, pagePoint, reportRow, sessionRow, T0 } from '../../testkit/fixtures.ts';
import { createMemoryStore } from './index.ts';

storeContract(
  'memory',
  async (opts) => {
    const store = createMemoryStore({ failingPointSink: opts?.failingPointSink === true });
    return { store, dump: async (table) => store.tables[table] };
  },
  { pointSinkFailure: true },
);

describe('memory store inspection', () => {
  it('tables return copies, so tests cannot corrupt the store', async () => {
    const store = createMemoryStore();
    const write = batchWrite();
    await store.applyBatch(write);
    write.events[0]!.name = 'mutated after write';
    const [event] = store.tables.events;
    assert.equal(event!.name, 'chat.open');
    event!.name = 'mutated after read';
    assert.equal(store.tables.events[0]!.name, 'chat.open');
  });

  it('records analytics points in order, as copies', async () => {
    const store = createMemoryStore();
    const first = pagePoint({ path: '/a' });
    await store.writePagePoint(first);
    await store.writePagePoint(pagePoint({ path: '/b' }));
    await store.writeDownloadPoint(downloadPoint());
    first.path = '/mutated';
    assert.deepEqual(
      store.pagePoints.map((p) => p.path),
      ['/a', '/b'],
    );
    assert.deepEqual(store.downloadPoints, [downloadPoint()]);
  });

  it('with a failing point sink drops the detail but still counts the rollup and answers ok', async () => {
    const store = createMemoryStore({ failingPointSink: true });
    assert.deepEqual(await store.writePagePoint(pagePoint()), { ok: true, value: undefined });
    assert.deepEqual(await store.writeDownloadPoint(downloadPoint({ country: null })), { ok: true, value: undefined });
    assert.deepEqual(store.pagePoints, []);
    assert.deepEqual(store.downloadPoints, []);
    assert.deepEqual(store.tables.site_daily, [
      { day: '2026-11-01', kind: 'view', key: '/', country: 'IN', count: 1 },
      { day: '2026-11-01', kind: 'download', key: 'lite', country: '', count: 1 },
    ]);
  });

  it('refuses a point without a day (an op bug), writing neither the detail nor the rollup', async () => {
    const store = createMemoryStore();
    const r = await store.writePagePoint(pagePoint({ day: undefined as unknown as string }));
    assert.deepEqual(!r.ok && [r.error.code, r.error.field], ['internal', 'site_daily.day']);
    const d = await store.writeDownloadPoint(downloadPoint({ day: null as unknown as string }));
    assert.equal(!d.ok && d.error.code, 'internal');
    assert.deepEqual(store.pagePoints, []);
    assert.deepEqual(store.downloadPoints, []);
    assert.deepEqual(store.tables.site_daily, []);
  });

  it('listSiteDaily returns copies, so callers cannot change the counts', async () => {
    const store = createMemoryStore();
    await store.writePagePoint(pagePoint());
    const r = await store.listSiteDaily('2026-11-01', '2026-11-01');
    assert.ok(r.ok);
    r.value[0]!.count = 99;
    assert.equal(store.tables.site_daily[0]!.count, 1);
  });

  it('usage has no database size to report, never pauses ingest, and reports the oldest kept rows', async () => {
    const store = createMemoryStore();
    const write = batchWrite();
    await store.applyBatch(write);
    const min = (rows: { received: number }[]): number | null => (rows.length ? Math.min(...rows.map((r) => r.received)) : null);
    assert.deepEqual(await store.usage(), {
      ok: true,
      value: {
        dbBytes: null,
        ingestPaused: false,
        oldestReceived: { events: min(write.events), errors: min(write.errors), reports: null },
      },
    });
  });

  it('keeps tables live through an object spread (tests override single methods that way)', async () => {
    const store = createMemoryStore();
    const wrapped = { ...store };
    await wrapped.applyBatch(batchWrite({ sessions: [sessionRow()], events: [eventRow({ received: T0 })], errors: [] }));
    assert.equal(wrapped.tables.events.length, 1);
    assert.equal(store.tables.sessions.length, 1);
  });

  it('refuses a report whose row and device row name different devices (an op bug), writing nothing', async () => {
    const store = createMemoryStore();
    const r = await store.insertReport(reportRow({ device_id: DEVICE_ID_2 }), deviceRow());
    assert.deepEqual(!r.ok && [r.error.code, r.error.field], ['internal', 'device_id']);
    assert.deepEqual(store.tables.reports, []);
    assert.deepEqual(store.tables.devices, []);
  });
});
