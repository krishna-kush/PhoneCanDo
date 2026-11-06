// The shared SQL store's applyBatch statements, run through the node:sqlite
// driver: generated SQL shape and order, D1 statement limits on a maximal
// batch, and idempotent counts on replays.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { STATEMENT_LIMITS, statementBytes } from './chunk.ts';
import { batchWrite, errorRow, eventRow, sessionRow } from '../../testkit/fixtures.ts';
import { count, freshDatabasePerTest, h, rec, row, store } from './store.test-support.ts';

freshDatabasePerTest();

describe('applyBatch: statements', () => {
  test('one atomic driver.batch per call, in device/install/sessions/events/errors order', async () => {
    const r = await store().applyBatch(batchWrite());
    assert.deepEqual(r, { ok: true, value: { sessions: 1, events: 1, errors: 1 } });
    assert.equal(rec.batches.length, 1);
    assert.deepEqual(
      rec.batches[0]!.map((s) => s.sql.match(/^INSERT INTO (\w+)/)?.[1]),
      ['devices', 'installs', 'sessions', 'events', 'errors'],
    );
    const [dev, ins, ses, evt, er] = rec.batches[0]!;
    assert.match(dev!.sql, / ON CONFLICT \(device_id\) DO UPDATE SET /);
    assert.match(ins!.sql, / ON CONFLICT \(install_id, device_id\) DO UPDATE SET /);
    assert.match(ses!.sql, / ON CONFLICT \(session_id\) DO UPDATE SET /);
    assert.match(evt!.sql, / ON CONFLICT \(session_id, seq\) DO NOTHING$/);
    assert.match(er!.sql, / ON CONFLICT \(error_id\) DO NOTHING$/);
  });

  test('a maximal batch stays under D1 limits in every statement and inserts every row', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => sessionRow({ session_id: `s${i}` }));
    const events = Array.from({ length: 500 }, (_, i) =>
      eventRow({ session_id: `s${i % 20}`, seq: i, props: JSON.stringify({ k: 'v'.repeat(400) }) }),
    );
    const errors = Array.from({ length: 50 }, (_, i) =>
      errorRow({ error_id: `e${i}`, message: 'm'.repeat(200), frames: JSON.stringify(Array(5).fill('f'.repeat(200))) }),
    );
    const r = await store().applyBatch(batchWrite({ sessions, events, errors }));
    assert.deepEqual(r, { ok: true, value: { sessions: 20, events: 500, errors: 50 } });
    assert.equal(rec.batches.length, 1);
    const stmts = rec.batches[0]!;
    assert.equal(stmts.length, 1 + 1 + 4 + 46 + 8);
    for (const s of stmts) {
      assert.ok(s.params.length <= STATEMENT_LIMITS.maxParams, `${s.params.length} params`);
      assert.ok(statementBytes(s) <= STATEMENT_LIMITS.maxBytes, `${statementBytes(s)} bytes`);
    }
    assert.equal(count(h.db, 'events'), 500);
    assert.equal(count(h.db, 'errors'), 50);
    assert.equal(count(h.db, 'sessions'), 20);
  });

  test('empty lists add no statements', async () => {
    const r = await store().applyBatch(batchWrite({ sessions: [], events: [], errors: [] }));
    assert.deepEqual(r, { ok: true, value: { sessions: 0, events: 0, errors: 0 } });
    assert.equal(rec.batches[0]!.length, 2);
  });
});

describe('applyBatch: idempotency and counts', () => {
  test('a replay inserts nothing new; sessions count as merged', async () => {
    const s = store();
    const w = batchWrite({ events: [eventRow(), eventRow({ seq: 2 })] });
    assert.deepEqual(await s.applyBatch(w), { ok: true, value: { sessions: 1, events: 2, errors: 1 } });
    const before = ['devices', 'installs', 'sessions', 'events', 'errors'].map((t) => count(h.db, t));
    assert.deepEqual(await s.applyBatch(w), { ok: true, value: { sessions: 1, events: 0, errors: 0 } });
    assert.deepEqual(
      ['devices', 'installs', 'sessions', 'events', 'errors'].map((t) => count(h.db, t)),
      before,
    );
    assert.deepEqual(row(h.db, 'SELECT * FROM sessions'), { ...sessionRow() });
  });

  test('a partly new batch counts only the new events and errors', async () => {
    const s = store();
    await s.applyBatch(batchWrite());
    const r = await s.applyBatch(
      batchWrite({ events: [eventRow(), eventRow({ seq: 5 })], errors: [errorRow(), errorRow({ error_id: 'e-new' })] }),
    );
    assert.deepEqual(r, { ok: true, value: { sessions: 1, events: 1, errors: 1 } });
  });

  test('the first write of a key wins for events and errors', async () => {
    const s = store();
    await s.applyBatch(batchWrite({ events: [eventRow({ name: 'first' })], errors: [errorRow({ message: 'first' })] }));
    await s.applyBatch(batchWrite({ events: [eventRow({ name: 'second' })], errors: [errorRow({ message: 'second' })] }));
    assert.equal(row(h.db, 'SELECT name FROM events').name, 'first');
    assert.equal(row(h.db, 'SELECT message FROM errors').message, 'first');
  });
});
