// The shared SQL store's merge rules, run through the node:sqlite driver: how
// repeated device, install and session rows combine, including the verifier
// coalesce and the sessions upsert's own device guard.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  DAY_MS,
  DEVICE_ID,
  DEVICE_ID_2,
  DRM_ID,
  DRM_ID_2,
  INSTALL_ID,
  INSTALL_ID_2,
  SESSION_ID,
  T0,
  batchWrite,
  deviceRow,
  installRow,
  sessionRow,
} from '../../testkit/fixtures.ts';
import { V1, as, count, freshDatabasePerTest, h, rec, row, store } from './store.test-support.ts';

freshDatabasePerTest();

describe('merge: devices', () => {
  const read = () => row(h.db, 'SELECT * FROM devices WHERE device_id = ?', DEVICE_ID);

  test('first_seen = min, last_seen = max, descriptive fields from the newer row', async () => {
    const s = store();
    await s.applyBatch(batchWrite({ device: deviceRow({ first_seen: T0, last_seen: T0, model: 'Mid', sdk_int: 35 }) }));
    // Older row arriving late: widens first_seen, changes nothing else.
    await s.applyBatch(
      batchWrite({ device: deviceRow({ first_seen: T0 - 5 * DAY_MS, last_seen: T0 - DAY_MS, model: 'Old', sdk_int: 33, country: 'DE' }) }),
    );
    let d = read();
    assert.equal(d.first_seen, T0 - 5 * DAY_MS);
    assert.equal(d.last_seen, T0);
    assert.equal(d.model, 'Mid');
    assert.equal(d.sdk_int, 35);
    assert.equal(d.country, 'IN');
    // Newer row: its descriptive fields win, null country included.
    await s.applyBatch(
      batchWrite({ device: deviceRow({ first_seen: T0 + DAY_MS, last_seen: T0 + DAY_MS, model: 'New', country: null, asn: null, tester: 1 }) }),
    );
    d = read();
    assert.equal(d.first_seen, T0 - 5 * DAY_MS);
    assert.equal(d.last_seen, T0 + DAY_MS);
    assert.equal(d.model, 'New');
    assert.equal(d.sdk_int, 36);
    assert.equal(d.country, null);
    assert.equal(d.asn, null);
    assert.equal(d.tester, 1);
  });

  test('drm_id keeps the newest non-null value', async () => {
    const s = store();
    await s.applyBatch(batchWrite({ device: deviceRow({ drm_id: DRM_ID, last_seen: T0 }) }));
    await s.applyBatch(batchWrite({ device: deviceRow({ drm_id: null, last_seen: T0 + 1 }) }));
    assert.equal(read().drm_id, DRM_ID, 'a newer null keeps the stored id');
    await s.applyBatch(batchWrite({ device: deviceRow({ drm_id: DRM_ID_2, last_seen: T0 - 1 }) }));
    assert.equal(read().drm_id, DRM_ID, 'an older id does not replace a newer one');
    await s.applyBatch(batchWrite({ device: deviceRow({ drm_id: DRM_ID_2, last_seen: T0 + 2 }) }));
    assert.equal(read().drm_id, DRM_ID_2, 'a newer id replaces it');
  });

  test('an older non-null drm_id fills a stored null', async () => {
    const s = store();
    await s.applyBatch(batchWrite({ device: deviceRow({ drm_id: null, last_seen: T0 }) }));
    await s.applyBatch(batchWrite({ device: deviceRow({ drm_id: DRM_ID, last_seen: T0 - 1 }) }));
    assert.equal(read().drm_id, DRM_ID);
  });

  test('the device upsert carries the verifier and keeps the first one (coalesce)', async () => {
    const r = await store().applyBatch(as(V1));
    assert.equal(r.ok, true);
    const [dev] = rec.batches[0]!;
    assert.match(dev!.sql, /^INSERT INTO devices \(device_id, verifier, /);
    assert.match(dev!.sql, /verifier = coalesce\(devices\.verifier, excluded\.verifier\)/);
    assert.equal(dev!.params[1], V1);
    assert.equal(read().verifier, V1);
  });
});

describe('merge: installs', () => {
  test('first_* from the older row; channel, install_source and last_* from the newer', async () => {
    const s = store();
    await s.applyBatch(batchWrite({ install: installRow() }));
    await s.applyBatch(
      batchWrite({
        install: installRow({
          channel: 'full',
          install_source: null,
          first_version: '0.1.3',
          last_version: '0.1.3',
          last_version_code: 13,
          first_seen: T0 + DAY_MS,
          last_seen: T0 + DAY_MS,
        }),
      }),
    );
    await s.applyBatch(
      batchWrite({
        install: installRow({
          channel: 'lite',
          first_version: '0.1.0',
          last_version: '0.1.1',
          last_version_code: 11,
          first_seen: T0 - DAY_MS,
          last_seen: T0 - DAY_MS,
        }),
      }),
    );
    assert.deepEqual(row(h.db, 'SELECT * FROM installs'), {
      ...installRow({
        channel: 'full',
        install_source: null,
        first_version: '0.1.0',
        last_version: '0.1.3',
        last_version_code: 13,
        first_seen: T0 - DAY_MS,
        last_seen: T0 + DAY_MS,
      }),
    });
  });
});

describe('merge: sessions', () => {
  const read = () => row(h.db, 'SELECT * FROM sessions WHERE session_id = ?', SESSION_ID);

  test('started = min, ended = max non-null, received = max', async () => {
    const s = store();
    await s.applyBatch(batchWrite({ sessions: [sessionRow({ started: T0 - 60_000, ended: null, received: T0 })] }));
    await s.applyBatch(batchWrite({ sessions: [sessionRow({ started: T0 - 30_000, ended: T0 + 5_000, received: T0 + 10 })] }));
    await s.applyBatch(batchWrite({ sessions: [sessionRow({ started: T0 - 90_000, ended: null, received: T0 + 20 })] }));
    await s.applyBatch(batchWrite({ sessions: [sessionRow({ ended: T0 + 1_000, received: T0 + 5 })] }));
    const r = read();
    assert.equal(r.started, T0 - 90_000);
    assert.equal(r.ended, T0 + 5_000);
    assert.equal(r.received, T0 + 20);
  });

  test('nullable fields keep the newest non-null value; counters JSON is replaced whole', async () => {
    const s = store();
    await s.applyBatch(
      batchWrite({ sessions: [sessionRow({ boot_ms: 1800, engine_exit_code: null, counters: '{"a":1,"b":2}', received: T0 })] }),
    );
    await s.applyBatch(
      batchWrite({
        sessions: [sessionRow({ boot_ms: null, engine_exit_code: 137, a11y_on: 1, counters: '{"a":5}', country: null, received: T0 + 1 })],
      }),
    );
    let r = read();
    assert.equal(r.boot_ms, 1800, 'newer null keeps stored value');
    assert.equal(r.engine_exit_code, 137, 'newer non-null fills');
    assert.equal(r.a11y_on, 1, 'newer non-null replaces');
    assert.equal(r.counters, '{"a":5}', 'replaced, not merged');
    assert.equal(r.country, 'IN');
    // An older resend only fills what is still null.
    await s.applyBatch(
      batchWrite({
        sessions: [sessionRow({ boot_ms: 999, engine_stderr_tail: 'tail', a11y_on: 0, counters: '{"old":1}', received: T0 - 100 })],
      }),
    );
    r = read();
    assert.equal(r.boot_ms, 1800);
    assert.equal(r.engine_stderr_tail, 'tail');
    assert.equal(r.a11y_on, 1);
    assert.equal(r.counters, '{"a":5}');
    assert.equal(r.received, T0 + 1);
  });

  test('the build (version, version_code, channel) and the install keep the first write, in either order', async () => {
    for (const [first, second] of [
      [{ received: T0 }, { received: T0 + 1 }],
      [{ received: T0 + 1 }, { received: T0 }],
    ]) {
      const s = store();
      await s.applyBatch(batchWrite({ sessions: [sessionRow({ ...first, boot_ms: null })] }));
      // A later flush from the updated app (another install) re-sends the old session.
      await s.applyBatch(
        batchWrite({
          install: installRow({ install_id: INSTALL_ID_2 }),
          sessions: [sessionRow({ ...second, install_id: INSTALL_ID_2, version: '0.1.3', version_code: 13, channel: 'full', boot_ms: 777 })],
        }),
      );
      const r = read();
      assert.deepEqual(
        { install_id: r.install_id, device_id: r.device_id, version: r.version, version_code: r.version_code, channel: r.channel },
        { install_id: INSTALL_ID, device_id: DEVICE_ID, version: '0.1.2', version_code: 12, channel: 'lite' },
      );
      assert.equal(r.boot_ms, 777, 'nullable fields still merge');
      assert.equal(r.received, T0 + 1);
      h.db.exec('DELETE FROM sessions; DELETE FROM events; DELETE FROM errors; DELETE FROM installs; DELETE FROM devices');
    }
  });

  test('the sessions upsert refuses a row from another device even without the store check', async () => {
    await store().applyBatch(batchWrite({ sessions: [sessionRow({ received: T0 })] }));
    // Straight through the driver, as a racing request would land after the check.
    const [stmt] = rec.batches[0]!.filter((st) => st.sql.startsWith('INSERT INTO sessions'));
    const params = [...stmt!.params];
    params[2] = DEVICE_ID_2; // device_id column
    await assert.rejects(h.driver.batch([{ sql: stmt!.sql, params }]), /NOT NULL constraint failed: sessions\.version/);
    assert.equal(read().device_id, DEVICE_ID);
  });

  test('two rows for one session in the same batch merge in order', async () => {
    const r = await store().applyBatch(
      batchWrite({ sessions: [sessionRow({ ended: null, received: T0 }), sessionRow({ ended: T0 + 9, boot_ms: null, received: T0 + 1 })] }),
    );
    assert.deepEqual(r, { ok: true, value: { sessions: 2, events: 1, errors: 1 } });
    assert.equal(count(h.db, 'sessions'), 1);
    assert.equal(read().ended, T0 + 9);
    assert.equal(read().boot_ms, 1800);
  });
});
