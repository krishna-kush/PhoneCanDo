import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { DEFAULT_CONFIG, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import {
  DAY_MS,
  ERROR_ID,
  ERROR_ID_2,
  ERROR_ID_3,
  REPORT_ID_2,
  T0,
  batchWrite,
  deviceRow,
  errorRow,
  eventRow,
  reportRow,
} from '../../testkit/fixtures.ts';
import { err } from '../result.ts';
import { RETENTION_DAYS, RETENTION_RUN } from '../schema/limits.ts';
import type { ErrorRow, EventRow } from '../schema/rows.ts';
import type { Store } from '../store.ts';
import { RETENTION_TABLES, retentionCutoff, retentionOp } from './retention.ts';

const NOW = T0 + 400 * DAY_MS;
/** Rows per table per run. */
const PER_RUN = RETENTION_RUN.rowsPerRun;

function setup(store: Store = createMemoryStore()): FakeCtx {
  return fakeCtx({ store, now: NOW });
}

async function seed(store: MemoryStore, events: EventRow[], errors: ErrorRow[]): Promise<void> {
  assert.equal((await store.applyBatch(batchWrite({ events, errors }))).ok, true);
}

/** Store a report for the fixture device (insertReport also upserts the device). */
async function seedReport(store: Store, over: Parameters<typeof reportRow>[0]): Promise<void> {
  assert.equal((await store.insertReport(reportRow(over), deviceRow())).ok, true);
}

/** `store` with every retention call logged into `calls` (`name` or `name:table:limit`). */
function spied(store: MemoryStore, calls: string[]): Store {
  return {
    ...store,
    deleteExpiredReports: async (before) => {
      calls.push('deleteExpiredReports');
      return store.deleteExpiredReports(before);
    },
    listExpired: async (table, before, limit) => {
      calls.push(`listExpired:${table}:${limit}`);
      return store.listExpired(table, before, limit);
    },
    deleteRows: async (table, rows) => {
      calls.push(`deleteRows:${table}`);
      return store.deleteRows(table, rows);
    },
  };
}

const oldEvents = () => [
  eventRow({ seq: 2, received: NOW - 92 * DAY_MS }),
  eventRow({ seq: 1, received: NOW - 95 * DAY_MS }),
  eventRow({ seq: 3, received: NOW - 89 * DAY_MS }), // still kept
];
const oldErrors = () => [
  errorRow({ error_id: ERROR_ID, received: NOW - 181 * DAY_MS }),
  errorRow({ error_id: ERROR_ID_2, received: NOW - 179 * DAY_MS }), // still kept
];

describe('retention', () => {
  it('is the cron every 15 minutes, bounded per table per run', () => {
    assert.deepEqual([retentionOp.kind, retentionOp.name, retentionOp.schedule], ['cron', 'retention', '*/15 * * * *']);
    assert.deepEqual(RETENTION_RUN, { rowsPerRun: 250 });
    assert.deepEqual(RETENTION_DAYS, { events: 90, errors: 180, reports: 90 });
    assert.deepEqual(RETENTION_TABLES, ['events', 'errors']);
    assert.equal(retentionCutoff('errors', NOW), NOW - 180 * DAY_MS);
  });

  it('deletes expired reports (90 d), events (90 d) and errors (180 d), and summarizes counts and statuses', async () => {
    const store = createMemoryStore();
    const ctx = setup(store);
    const events = oldEvents();
    const errors = oldErrors();
    await seed(store, events, errors);
    await seedReport(store, { received: NOW - 91 * DAY_MS });
    await seedReport(store, { report_id: REPORT_ID_2, received: NOW });

    const r = await retentionOp.run(ctx);
    assert.deepEqual(r, {
      ok: true,
      value: { reports: 1, reportsStatus: 'deleted', events: 2, eventsStatus: 'deleted', errors: 1, errorsStatus: 'deleted' },
    });
    assert.deepEqual(store.tables.events, [events[2]]);
    assert.deepEqual(store.tables.errors, [errors[1]]);
    assert.deepEqual(
      store.tables.reports.map((x) => x.report_id),
      [REPORT_ID_2],
    );
    assert.equal(ctx.log.entries.length, 0, 'a clean run logs nothing (runCron logs the summary)');

    // Nothing left to delete: the next run is a no-op.
    const again = await retentionOp.run(ctx);
    assert.deepEqual(again, {
      ok: true,
      value: { reports: 0, reportsStatus: 'none', events: 0, eventsStatus: 'none', errors: 0, errorsStatus: 'none' },
    });
  });

  it('when switched off (production default) lists and deletes nothing, even with expired rows', async () => {
    const store = createMemoryStore();
    const calls: string[] = [];
    const ctx = fakeCtx({ store: spied(store, calls), now: NOW, config: { ...DEFAULT_CONFIG, retentionEnabled: false } });
    const events = oldEvents();
    const errors = oldErrors();
    await seed(store, events, errors);
    await seedReport(store, { received: NOW - 91 * DAY_MS });

    const r = await retentionOp.run(ctx);
    assert.deepEqual(r, {
      ok: true,
      value: { reports: 0, reportsStatus: 'disabled', events: 0, eventsStatus: 'disabled', errors: 0, errorsStatus: 'disabled' },
    });
    assert.deepEqual(calls, [], 'a disabled run costs no store calls (no D1 reads or writes)');
    assert.equal(store.tables.events.length, 3);
    assert.equal(store.tables.errors.length, 2);
    assert.equal(store.tables.reports.length, 1);
  });

  it('does nothing when nothing is expired, and never calls deleteRows', async () => {
    const store = createMemoryStore();
    const calls: string[] = [];
    const ctx = setup(spied(store, calls));
    await seed(store, [eventRow({ received: NOW - DAY_MS })], [errorRow({ received: NOW - DAY_MS })]);
    const r = await retentionOp.run(ctx);
    assert.deepEqual(r.ok && [r.value.events, r.value.eventsStatus, r.value.errors, r.value.errorsStatus], [0, 'none', 0, 'none']);
    assert.deepEqual(calls, ['deleteExpiredReports', `listExpired:events:${PER_RUN}`, `listExpired:errors:${PER_RUN}`]);
    assert.equal(store.tables.events.length, 1);
    assert.equal(store.tables.errors.length, 1);
  });

  it('runs report expiry first, then events, then errors, asking for at most RETENTION_RUN.rowsPerRun rows', async () => {
    const store = createMemoryStore();
    const calls: string[] = [];
    await seed(store, oldEvents(), oldErrors());
    await retentionOp.run(setup(spied(store, calls)));
    assert.deepEqual(calls, [
      'deleteExpiredReports',
      `listExpired:events:${PER_RUN}`,
      'deleteRows:events',
      `listExpired:errors:${PER_RUN}`,
      'deleteRows:errors',
    ]);
  });

  it('deletes at most RETENTION_RUN.rowsPerRun rows per table per run, oldest first', async () => {
    const store = createMemoryStore();
    const ctx = setup(store);
    const events = Array.from({ length: PER_RUN + 1 }, (_, i) => eventRow({ seq: i, received: NOW - 200 * DAY_MS + i }));
    const errors = Array.from({ length: 3 }, (_, i) => errorRow({ error_id: [ERROR_ID, ERROR_ID_2, ERROR_ID_3][i]!, received: NOW - 300 * DAY_MS + i }));
    await seed(store, events, errors);

    const first = await retentionOp.run(ctx);
    assert.deepEqual(first.ok && [first.value.events, first.value.eventsStatus, first.value.errors], [PER_RUN, 'deleted', 3]);
    assert.deepEqual(store.tables.events, [events[PER_RUN]], 'the newest expired row waits');
    const second = await retentionOp.run(ctx);
    assert.deepEqual(second.ok && [second.value.events, second.value.eventsStatus, second.value.errorsStatus], [1, 'deleted', 'none']);
    assert.deepEqual(store.tables.events, []);
  });

  it('expires 2 x rowsPerRun + 1 events received in the same millisecond across three runs with no loss', async () => {
    const store = createMemoryStore();
    const ctx = setup(store);
    const total = 2 * PER_RUN + 1;
    await seed(store, Array.from({ length: total }, (_, i) => eventRow({ seq: i, received: NOW - 100 * DAY_MS })), []);
    const runs = [];
    for (let i = 0; i < 3; i++) runs.push(await retentionOp.run(ctx));
    assert.deepEqual(
      runs.map((r) => r.ok && r.value.events),
      [PER_RUN, PER_RUN, 1],
    );
    assert.deepEqual(store.tables.events, []);
  });

  it('never touches rows at or after the cutoff', async () => {
    const store = createMemoryStore();
    const ctx = setup(store);
    const eventsCutoff = retentionCutoff('events', NOW);
    const errorsCutoff = retentionCutoff('errors', NOW);
    const reportsCutoff = retentionCutoff('reports', NOW);
    const events = [
      eventRow({ seq: 1, received: eventsCutoff - 1 }),
      eventRow({ seq: 2, received: eventsCutoff }),
      eventRow({ seq: 3, received: eventsCutoff + 1 }),
    ];
    const errors = [
      errorRow({ error_id: ERROR_ID, received: errorsCutoff - 1 }),
      errorRow({ error_id: ERROR_ID_2, received: errorsCutoff }),
      errorRow({ error_id: ERROR_ID_3, received: errorsCutoff + 1 }),
    ];
    await seed(store, events, errors);
    await seedReport(store, { received: reportsCutoff - 1 });
    await seedReport(store, { report_id: REPORT_ID_2, received: reportsCutoff });

    const r = await retentionOp.run(ctx);
    assert.deepEqual(r.ok && [r.value.reports, r.value.events, r.value.errors], [1, 1, 1]);
    assert.deepEqual(store.tables.events, events.slice(1));
    assert.deepEqual(store.tables.errors, errors.slice(1));
    assert.deepEqual(
      store.tables.reports.map((x) => x.report_id),
      [REPORT_ID_2],
    );
    // A second run finds nothing more: the rows at the cutoff stay.
    const again = await retentionOp.run(ctx);
    assert.deepEqual(again.ok && [again.value.reports, again.value.events, again.value.errors], [0, 0, 0]);
    assert.equal(store.tables.events.length, 2);
  });

  it('a listing failure in events keeps its rows and still expires reports and errors', async () => {
    const store = createMemoryStore();
    await seed(store, oldEvents(), oldErrors());
    await seedReport(store, { received: NOW - 91 * DAY_MS });
    const ctx = setup({
      ...store,
      listExpired: async (table, before, limit) => (table === 'events' ? err('unavailable', 'db busy') : store.listExpired(table, before, limit)),
    });
    const r = await retentionOp.run(ctx);
    assert.equal(r.ok, true, 'a failed table never fails the run');
    assert.deepEqual(r.ok && r.value, {
      reports: 1,
      reportsStatus: 'deleted',
      events: 0,
      eventsStatus: 'list_failed:unavailable',
      errors: 1,
      errorsStatus: 'deleted',
    });
    assert.equal(store.tables.events.length, 3);
    assert.deepEqual(
      store.tables.errors.map((e) => e.error_id),
      [ERROR_ID_2],
    );
    assert.deepEqual(
      ctx.log.entries.map((e) => [e.level, e.message, e.data?.['table'], e.data?.['code']]),
      [['warn', 'retention: listing expired rows failed', 'events', 'unavailable']],
    );
  });

  it('a delete failure in events keeps its rows and still runs errors', async () => {
    const store = createMemoryStore();
    await seed(store, oldEvents(), oldErrors());
    const ctx = setup({
      ...store,
      deleteRows: async (table, rows) => (table === 'events' ? err('unavailable', 'db busy') : store.deleteRows(table, rows)),
    });
    const r = await retentionOp.run(ctx);
    assert.deepEqual(
      r.ok && [r.value.events, r.value.eventsStatus, r.value.errors, r.value.errorsStatus],
      [0, 'delete_failed:unavailable', 1, 'deleted'],
    );
    assert.equal(store.tables.events.length, 3);
    assert.equal(store.tables.errors.length, 1);
    assert.deepEqual(
      ctx.log.entries.map((e) => [e.level, e.message, e.data?.['table']]),
      [['warn', 'retention: expired rows not deleted', 'events']],
    );
  });

  it('a failure in errors does not undo or stop the steps before it', async () => {
    const store = createMemoryStore();
    await seed(store, oldEvents(), oldErrors());
    const ctx = setup({
      ...store,
      listExpired: async (table, before, limit) => (table === 'errors' ? err('internal', 'bad statement') : store.listExpired(table, before, limit)),
    });
    const r = await retentionOp.run(ctx);
    assert.deepEqual(r.ok && [r.value.eventsStatus, r.value.events, r.value.errorsStatus, r.value.errors], ['deleted', 2, 'list_failed:internal', 0]);
    assert.equal(store.tables.events.length, 1);
    assert.equal(store.tables.errors.length, 2);
  });

  it('a report-retention failure is reported without failing the run or the tables', async () => {
    const store = createMemoryStore();
    await seed(store, oldEvents(), oldErrors());
    const ctx = setup({ ...store, deleteExpiredReports: async () => err('unavailable', 'db busy') });
    const r = await retentionOp.run(ctx);
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.value, {
      reports: 0,
      reportsStatus: 'delete_failed:unavailable',
      events: 2,
      eventsStatus: 'deleted',
      errors: 1,
      errorsStatus: 'deleted',
    });
    assert.deepEqual(
      ctx.log.entries.map((e) => [e.level, e.message, e.data?.['code']]),
      [['warn', 'retention: expired reports not deleted', 'unavailable']],
    );
  });

  it('expires reports even when the run dies inside the events step (CPU limit)', async () => {
    const store = createMemoryStore();
    await seed(store, oldEvents(), []);
    await seedReport(store, { received: retentionCutoff('reports', NOW) - 1 });
    await seedReport(store, { report_id: REPORT_ID_2, received: retentionCutoff('reports', NOW) });
    // A Worker over its CPU budget stops mid-await; a throw stands in for that here.
    const dying = setup({
      ...store,
      listExpired: async () => {
        throw new Error('exceeded CPU time limit');
      },
    });
    await assert.rejects(retentionOp.run(dying), /CPU time limit/);
    assert.deepEqual(
      store.tables.reports.map((x) => x.report_id),
      [REPORT_ID_2],
    );
    assert.equal(store.tables.events.length, 3);
  });
});
