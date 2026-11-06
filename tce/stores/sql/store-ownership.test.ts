// The shared SQL store's device ownership in applyBatch, run through the
// node:sqlite driver: verifier pinning, foreign sessions, the chunked
// ownership read, and the re-checks that catch a concurrent writer.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { STATEMENT_LIMITS } from './chunk.ts';
import type { SqlDriver, SqlStatement } from './driver.ts';
import { createSqlStore } from './store.ts';
import {
  DAY_MS,
  DEVICE_ID,
  DEVICE_ID_2,
  INSTALL_ID_2,
  INSTALL_ID_3,
  SESSION_ID,
  SESSION_ID_2,
  SESSION_ID_3,
  T0,
  errorRow,
  eventRow,
  installRow,
  sessionRow,
} from '../../testkit/fixtures.ts';
import { V1, V2, V_BAD, as, count, freshDatabasePerTest, h, log, rec, row, store } from './store.test-support.ts';

freshDatabasePerTest();

describe('ownership', () => {
  const read = () => row(h.db, 'SELECT * FROM devices WHERE device_id = ?', DEVICE_ID);
  const tables = ['devices', 'installs', 'sessions', 'events', 'errors'] as const;
  const snapshot = () => Object.fromEntries(tables.map((t) => [t, h.db.prepare(`SELECT * FROM ${t}`).all().map((r) => ({ ...r }))]));

  test('the first verifier pins the device; a matching one keeps writing and merging', async () => {
    const s = store();
    assert.equal((await s.applyBatch(as(V1))).ok, true);
    const r = await s.applyBatch(as(V1, { events: [eventRow({ seq: 2 })] }, { model: 'Pixel 9', last_seen: T0 + 1 }));
    assert.deepEqual(r, { ok: true, value: { sessions: 1, events: 1, errors: 0 } });
    assert.equal(read().verifier, V1);
    assert.equal(read().model, 'Pixel 9');
  });

  test('another verifier is forbidden and writes nothing at all', async () => {
    const s = store();
    await s.applyBatch(as(V1));
    const before = snapshot();
    const batchesBefore = rec.batches.length;
    const r = await s.applyBatch(
      as(
        V_BAD,
        {
          install: installRow({ install_id: INSTALL_ID_2 }),
          sessions: [sessionRow({ session_id: SESSION_ID_2, install_id: INSTALL_ID_2 })],
          events: [eventRow({ session_id: SESSION_ID_2, install_id: INSTALL_ID_2 })],
          errors: [errorRow({ error_id: 'e-impostor', session_id: null, seq: null })],
        },
        { model: 'Impostor', last_seen: T0 + DAY_MS },
      ),
    );
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.error.code, 'forbidden');
    assert.equal(rec.batches.length, batchesBefore, 'no write batch was even sent');
    assert.deepEqual(snapshot(), before);
    assert.equal(log.entries.length, 0, 'a refusal is an answer, not a storage failure');
  });

  test('a null verifier against a pinned device is forbidden too', async () => {
    const s = store();
    await s.applyBatch(as(V1));
    const r = await s.applyBatch(as(null));
    assert.equal(!r.ok && r.error.code, 'forbidden');
    assert.equal(read().verifier, V1);
  });

  test('a device row from before migration 0002 (null verifier) is filled by the next write, then pinned', async () => {
    const s = store();
    // A legacy row: written while the column did not exist (null), by any path.
    await s.applyBatch(as(null));
    assert.equal(read().verifier, null);
    const fill = await s.applyBatch(as(V1, {}, { last_seen: T0 - DAY_MS }));
    assert.equal(fill.ok, true, 'any verifier fills a null one, even from an older row');
    assert.equal(read().verifier, V1);
    assert.equal(read().last_seen, T0, 'the older row merged as usual');
    const other = await s.applyBatch(as(V2));
    assert.equal(!other.ok && other.error.code, 'forbidden');
    assert.equal(read().verifier, V1);
  });

  test('a session that belongs to another device is forbidden and writes nothing', async () => {
    const s = store();
    await s.applyBatch(as(V1));
    const before = snapshot();
    const other = { device_id: DEVICE_ID_2, install_id: INSTALL_ID_3 };
    const r = await s.applyBatch(
      as(
        V2,
        {
          install: installRow(other),
          sessions: [sessionRow({ ...other, session_id: SESSION_ID_3 }), sessionRow({ ...other, boot_ms: 1 })],
          events: [eventRow({ ...other, session_id: SESSION_ID_3 }), eventRow({ ...other, seq: 99 })],
          errors: [],
        },
        { device_id: DEVICE_ID_2 },
      ),
    );
    assert.equal(!r.ok && r.error.code, 'forbidden');
    assert.deepEqual(snapshot(), before, 'not even the new device, install or session was written');
  });

  test('one read checks the device and every session; more than 99 sessions are chunked', async () => {
    const s = store();
    await s.applyBatch(as(V1));
    rec.reads.length = 0;
    await s.applyBatch(as(V1, { sessions: [sessionRow(), sessionRow({ session_id: SESSION_ID_2 }), sessionRow()] }));
    assert.equal(rec.reads.length, 1);
    assert.deepEqual(rec.reads[0]!.params, [DEVICE_ID, SESSION_ID, SESSION_ID_2], 'device first, session ids deduplicated');

    rec.reads.length = 0;
    const many = Array.from({ length: 250 }, (_, i) => sessionRow({ session_id: `s-${i}` }));
    const r = await s.applyBatch(as(V1, { sessions: many, events: [], errors: [] }));
    assert.deepEqual(r, { ok: true, value: { sessions: 250, events: 0, errors: 0 } });
    assert.deepEqual(
      rec.reads.map((q) => q.params.length),
      [100, 99, 52], // 1 device id + 99 session ids, then 99 + 52 session ids
    );
    for (const q of rec.reads) assert.ok(q.params.length <= STATEMENT_LIMITS.maxParams);

    // The foreign session is in the last chunk: still found.
    await s.applyBatch(as(V2, { sessions: [sessionRow({ session_id: 'theirs', device_id: DEVICE_ID_2 })], events: [], errors: [] }, { device_id: DEVICE_ID_2 }));
    const mixed = [...many, sessionRow({ session_id: 'theirs' })];
    const denied = await s.applyBatch(as(V1, { sessions: mixed, events: [], errors: [] }));
    assert.equal(!denied.ok && denied.error.code, 'forbidden');
  });

  /** A driver that lets `intrude` write right after the ownership read, before the write batch. */
  function racing(intrude: () => void): SqlDriver {
    let armed = true;
    return {
      batch: (stmts) => h.driver.batch(stmts),
      async all<T>(sql: string, params: SqlStatement['params']) {
        const rows = await h.driver.all<T>(sql, params);
        if (armed) {
          armed = false;
          intrude();
        }
        return rows;
      },
    };
  }

  test('a verifier pinned by a concurrent writer after the check aborts the whole batch (forbidden)', async () => {
    const s = createSqlStore(
      racing(() => {
        h.db
          .prepare(
            `INSERT INTO devices (device_id, verifier, hw_hash, manufacturer, model, sdk_int, abi, ram_gb, locale, tester, first_seen, last_seen)
             VALUES (?, ?, 'h', 'm', 'Racer', 36, 'a', 8, 'en', 0, ?, ?)`,
          )
          .run(DEVICE_ID, V2, T0, T0);
      }),
      {},
      log,
    );
    const r = await s.applyBatch(as(V1));
    assert.equal(!r.ok && r.error.code, 'forbidden');
    assert.deepEqual({ ...read() }.verifier, V2);
    assert.equal(read().model, 'Racer', 'the racer keeps its row');
    for (const t of ['installs', 'sessions', 'events', 'errors']) assert.equal(count(h.db, t), 0, t);
    assert.equal(h.db.isTransaction, false);
  });

  test('a session claimed by a concurrent writer after the check aborts the whole batch (forbidden)', async () => {
    const s = createSqlStore(
      racing(() => {
        h.db
          .prepare(
            `INSERT INTO sessions (session_id, install_id, device_id, version, version_code, channel, started, received)
             VALUES (?, ?, ?, '0.1.2', 12, 'lite', ?, ?)`,
          )
          .run(SESSION_ID, INSTALL_ID_3, DEVICE_ID_2, T0, T0);
      }),
      {},
      log,
    );
    const r = await s.applyBatch(as(V1));
    assert.equal(!r.ok && r.error.code, 'forbidden');
    assert.equal(row(h.db, 'SELECT device_id FROM sessions WHERE session_id = ?', SESSION_ID).device_id, DEVICE_ID_2);
    for (const t of ['devices', 'installs', 'events', 'errors']) assert.equal(count(h.db, t), 0, t);
  });
});
