// The shared SQL store's expired-row scans (what the retention cron drains),
// run through the node:sqlite driver: listExpired order, limit and shape,
// chunked deleteRows, and tables outside retention refused.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SESSION_ID_2, T0, batchWrite, errorRow, eventRow, sessionRow } from '../../testkit/fixtures.ts';
import { count, freshDatabasePerTest, h, rec, store } from './store.test-support.ts';

freshDatabasePerTest();

describe('retention scans', () => {
  async function seedEvents(s: ReturnType<typeof store>): Promise<void> {
    const events = [
      eventRow({ seq: 1, received: T0 + 3 }),
      eventRow({ seq: 2, received: T0 + 1 }),
      eventRow({ seq: 3, received: T0 + 2 }),
      eventRow({ session_id: SESSION_ID_2, seq: 1, received: T0 + 1 }),
      eventRow({ seq: 4, received: T0 + 10 }),
    ];
    await s.applyBatch(batchWrite({ sessions: [sessionRow(), sessionRow({ session_id: SESSION_ID_2 })], events, errors: [] }));
  }

  test('listExpired returns the oldest rows below the cutoff, ordered, limited, exactly shaped', async () => {
    const s = store();
    await seedEvents(s);
    const r = await s.listExpired('events', T0 + 10, 3);
    assert.ok(r.ok);
    assert.deepEqual(r.value, [
      eventRow({ seq: 2, received: T0 + 1 }),
      eventRow({ session_id: SESSION_ID_2, seq: 1, received: T0 + 1 }),
      eventRow({ seq: 3, received: T0 + 2 }),
    ]);
    const all = await s.listExpired('events', T0 + 10, 100);
    assert.equal(all.ok && all.value.length, 4);
    assert.deepEqual(await s.listExpired('events', T0, 10), { ok: true, value: [] });
    assert.deepEqual(await s.listExpired('events', T0 + 100, 0), { ok: true, value: [] });
  });

  test('listExpired and deleteRows work on errors too', async () => {
    const s = store();
    const errors = [errorRow({ error_id: 'b', received: T0 }), errorRow({ error_id: 'a', received: T0 }), errorRow({ error_id: 'c', received: T0 + 5 })];
    await s.applyBatch(batchWrite({ errors }));
    const r = await s.listExpired('errors', T0 + 1, 10);
    assert.ok(r.ok);
    assert.deepEqual(
      r.value.map((e) => e.error_id),
      ['a', 'b'],
    );
    assert.deepEqual(r.value[0], errors[1]);
    assert.deepEqual(await s.deleteRows('errors', r.value), { ok: true, value: 2 });
    assert.deepEqual(
      (h.db.prepare('SELECT error_id FROM errors').all() as { error_id: string }[]).map((e) => e.error_id),
      ['c'],
    );
  });

  test('deleteRows deletes exactly the given keys, chunked into one atomic batch', async () => {
    const s = store();
    const events = Array.from({ length: 130 }, (_, i) => eventRow({ seq: i, received: T0 + i }));
    await s.applyBatch(batchWrite({ events, errors: [] }));
    rec.batches.length = 0;
    const victims = events.filter((e) => e.seq % 2 === 0).concat(eventRow({ seq: 9_999 })); // 65 real + 1 absent
    assert.deepEqual(await s.deleteRows('events', victims), { ok: true, value: 65 });
    assert.equal(rec.batches.length, 1);
    assert.deepEqual(
      rec.batches[0]!.map((st) => st.params.length / 2),
      [50, 16],
    );
    assert.equal(count(h.db, 'events'), 65);
    assert.equal((h.db.prepare('SELECT count(*) AS n FROM events WHERE seq % 2 = 0').get() as { n: number }).n, 0);
    assert.deepEqual(await s.deleteRows('events', []), { ok: true, value: 0 });
    assert.equal(rec.batches.length, 1, 'no batch for no rows');
  });

  test('a table that is not archivable is bad_request', async () => {
    const s = store();
    const l = await s.listExpired('devices' as 'events', T0, 10);
    assert.equal(!l.ok && l.error.code, 'bad_request');
    const d = await s.deleteRows('__proto__' as 'events', [eventRow()]);
    assert.equal(!d.ok && d.error.code, 'bad_request');
    const n = await s.listExpired('events', Number.NaN, 10);
    assert.equal(!n.ok && n.error.code, 'bad_request');
  });
});
