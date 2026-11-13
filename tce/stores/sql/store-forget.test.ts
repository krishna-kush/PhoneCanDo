// The shared SQL store's forget, run through the node:sqlite driver: one
// atomic delete across every table of the device, refusals that delete
// nothing, and the query plans (migration 0002 indexes) behind forget, the
// ownership read and report retention.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { ForgettableTable } from '../../core/schema/rows.ts';
import { COUNT_REPORTS_SINCE, DELETE_REPORTS_BEFORE, FORGET_STATEMENTS } from './store.ts';
import {
  DEVICE_ID,
  DEVICE_ID_2,
  INSTALL_ID_2,
  SESSION_ID_2,
  SESSION_ID_3,
  T0,
  errorRow,
  eventRow,
  installRow,
  reportRow,
  sessionRow,
} from '../../testkit/fixtures.ts';
import { V1, V2, V_BAD, as, count, counts, dev, freshDatabasePerTest, h, rec, row, store } from './store.test-support.ts';

freshDatabasePerTest();

describe('forget', () => {
  /** Two installs on DEVICE_ID (verifier V1) with a report, plus DEVICE_ID_2 (V2) with its own rows. */
  async function seed(s: ReturnType<typeof store>): Promise<void> {
    await s.applyBatch(
      as(V1, { events: [eventRow(), eventRow({ seq: 2 })], errors: [errorRow(), errorRow({ error_id: 'e2', session_id: null, seq: null })] }),
    );
    await s.applyBatch(
      as(V1, {
        install: installRow({ install_id: INSTALL_ID_2 }),
        sessions: [sessionRow({ session_id: SESSION_ID_2, install_id: INSTALL_ID_2 })],
        events: [eventRow({ session_id: SESSION_ID_2, install_id: INSTALL_ID_2 })],
        errors: [],
      }),
    );
    await s.insertReport(reportRow(), dev(V1));
    await s.applyBatch(
      as(
        V2,
        {
          install: installRow({ device_id: DEVICE_ID_2 }),
          sessions: [sessionRow({ session_id: 'other-session', device_id: DEVICE_ID_2 })],
          events: [eventRow({ session_id: 'other-session', device_id: DEVICE_ID_2 })],
          errors: [errorRow({ error_id: 'other-error', session_id: 'other-session', device_id: DEVICE_ID_2 })],
        },
        { device_id: DEVICE_ID_2 },
      ),
    );
    await s.insertReport(reportRow({ report_id: 'other-report', device_id: DEVICE_ID_2 }), dev(V2, { device_id: DEVICE_ID_2 }));
  }

  test('deletes every row of the device across all its installs, atomically, with counts', async () => {
    const s = store();
    await seed(s);
    rec.batches.length = 0;
    const r = await s.forget(DEVICE_ID, V1);
    assert.deepEqual(r, { ok: true, value: counts({ events: 3, errors: 2, reports: 1, sessions: 2, installs: 2, devices: 1 }) });
    assert.equal(rec.batches.length, 1, 'one atomic batch');
    assert.deepEqual(
      rec.batches[0]!.map((st) => st.sql),
      ['events', 'errors', 'reports', 'share_daily', 'share_installs', 'share_links', 'sessions', 'installs', 'devices'].map(
        (t) => FORGET_STATEMENTS[t as ForgettableTable],
      ),
    );
    assert.match(rec.batches[0]![0]!.sql, /^DELETE FROM events WHERE session_id IN \(SELECT session_id FROM sessions WHERE device_id = \?\)$/);
    assert.ok(rec.batches[0]!.every((st) => st.params.length === 1 && st.params[0] === DEVICE_ID));
    for (const t of ['devices', 'installs', 'sessions', 'events', 'errors', 'reports']) {
      assert.equal(count(h.db, t), 1, `${t}: only the other device remains`);
      assert.equal((h.db.prepare(`SELECT count(*) AS n FROM ${t} WHERE device_id = ?`).get(DEVICE_ID) as { n: number }).n, 0);
    }
  });

  test('not_found for a wrong, empty or other device’s verifier and for an unknown device; nothing is deleted', async () => {
    const s = store();
    await seed(s);
    const before = ['devices', 'installs', 'sessions', 'events', 'errors', 'reports'].map((t) => count(h.db, t));
    rec.batches.length = 0;
    for (const [deviceId, verifier] of [
      [DEVICE_ID, V_BAD],
      [DEVICE_ID, V2],
      [DEVICE_ID_2, V1],
      [DEVICE_ID, ''],
      ['f'.repeat(64), V1],
    ] as const) {
      const r = await s.forget(deviceId, verifier);
      assert.equal(!r.ok && r.error.code, 'not_found', `${deviceId.slice(0, 4)}/${verifier.slice(0, 4)}`);
    }
    const nul = await s.forget(DEVICE_ID, null as unknown as string);
    assert.equal(!nul.ok && nul.error.code, 'not_found');
    assert.equal(rec.batches.length, 0, 'no delete was sent');
    assert.deepEqual(
      ['devices', 'installs', 'sessions', 'events', 'errors', 'reports'].map((t) => count(h.db, t)),
      before,
    );
  });

  test('a device with no pinned verifier (written before migration 0002) cannot be forgotten until it writes again', async () => {
    const s = store();
    await s.applyBatch(as(null));
    const r = await s.forget(DEVICE_ID, V1);
    assert.equal(!r.ok && r.error.code, 'not_found');
    await s.applyBatch(as(V1, { sessions: [], events: [], errors: [] }));
    assert.deepEqual(await s.forget(DEVICE_ID, V1), {
      ok: true,
      value: counts({ events: 1, errors: 1, sessions: 1, installs: 1, devices: 1 }),
    });
  });

  test('a second forget is not_found; the device can start over with a new verifier', async () => {
    const s = store();
    await seed(s);
    assert.equal((await s.forget(DEVICE_ID, V1)).ok, true);
    const again = await s.forget(DEVICE_ID, V1);
    assert.equal(!again.ok && again.error.code, 'not_found');
    assert.equal((await s.applyBatch(as(V_BAD, { sessions: [sessionRow({ session_id: SESSION_ID_3 })], events: [], errors: [] }))).ok, true);
    assert.equal(row(h.db, 'SELECT verifier FROM devices WHERE device_id = ?', DEVICE_ID).verifier, V_BAD);
  });
});

describe('query plans (migration 0002 and 0004 indexes)', () => {
  /** SQLite's plan for `sql` as one string of detail lines. */
  const plan = (sql: string, params: (string | number)[]): string =>
    (h.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((r) => r.detail).join(' | ');

  test('every forget statement is an index lookup, never a table scan', () => {
    const expected: Record<ForgettableTable, RegExp> = {
      events: /SEARCH events USING PRIMARY KEY \(session_id=\?\).*SEARCH sessions USING COVERING INDEX sessions_device \(device_id=\?\)|SEARCH sessions USING COVERING INDEX sessions_device \(device_id=\?\).*SEARCH events USING PRIMARY KEY \(session_id=\?\)/,
      errors: /^SEARCH errors USING (COVERING )?INDEX errors_device \(device_id=\?\)$/,
      reports: /^SEARCH reports USING (COVERING )?INDEX reports_device \(device_id=\?\)$/,
      sessions: /^SEARCH sessions USING (COVERING )?INDEX sessions_device \(device_id=\?\)$/,
      installs: /^SEARCH installs USING (COVERING )?INDEX installs_device \(device_id=\?\)$/,
      devices: /^SEARCH devices USING PRIMARY KEY \(device_id=\?\)$/,
      share_daily: /SEARCH share_daily USING PRIMARY KEY \(code=\?\).*SEARCH share_links USING (COVERING )?INDEX share_links_device \(device_id=\?\)|SEARCH share_links USING (COVERING )?INDEX share_links_device \(device_id=\?\).*SEARCH share_daily USING PRIMARY KEY \(code=\?\)/,
      share_installs: /MULTI-INDEX OR.*SEARCH share_installs USING PRIMARY KEY \(device_id=\?\).*SEARCH share_installs USING (COVERING )?INDEX share_installs_code \(code=\?\)/,
      share_links: /^SEARCH share_links USING (COVERING )?INDEX share_links_device \(device_id=\?\)$/,
    };
    for (const [table, sql] of Object.entries(FORGET_STATEMENTS) as [ForgettableTable, string][]) {
      const p = plan(sql, [DEVICE_ID]);
      assert.match(p, expected[table], `${table}: ${p}`);
      assert.doesNotMatch(p, /\bSCAN\b/, `${table}: ${p}`);
    }
  });

  test('the forget check, the ownership read and report retention use indexes', async () => {
    const forgetCheck = plan('SELECT 1 AS one FROM devices WHERE device_id = ? AND verifier = ? LIMIT 1', [DEVICE_ID, V1]);
    assert.match(forgetCheck, /^SEARCH devices USING PRIMARY KEY \(device_id=\?\)$/);
    assert.match(plan(COUNT_REPORTS_SINCE, [T0]), /^SEARCH reports USING COVERING INDEX reports_received \(received>\?\)$/);
    assert.match(plan(DELETE_REPORTS_BEFORE, [T0]), /^SEARCH reports USING (COVERING )?INDEX reports_received \(received<\?\)$/);
    await store().applyBatch(as(V1, { sessions: [sessionRow(), sessionRow({ session_id: SESSION_ID_2 })] }));
    const read = rec.reads[0]!;
    const p = plan(read.sql, read.params as (string | number)[]);
    assert.doesNotMatch(p, /\bSCAN (devices|sessions)\b/, p);
    assert.match(p, /SEARCH devices USING PRIMARY KEY/);
    assert.match(p, /SEARCH sessions USING PRIMARY KEY \(session_id=\?\)/);
  });
});
