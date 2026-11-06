// Contract cases for forget: only the pinned verifier deletes, and it deletes
// every row of the device (across installs, through its sessions) and nothing
// of other devices.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEVICE_ID,
  DEVICE_ID_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  ERROR_ID_2,
  ERROR_ID_3,
  ERROR_ID_4,
  INSTALL_ID_2,
  INSTALL_ID_3,
  REPORT_ID_2,
  SESSION_ID_2,
  SESSION_ID_3,
  STRANGER_VERIFIER,
  T0,
  batchWrite,
  deviceRow,
  errorRow,
  eventRow,
  installRow,
  reportRow,
  sessionRow,
} from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, counts, expectEmpty, expectRows, expired, failure, plain, snapshot, using, value } from './harness.ts';

/** Register the `forget` cases. */
export function forgetCases(make: Make): void {
  describe('forget', () => {
    it(
      'returns not_found for an unknown device or a verifier that is not the pinned one, deleting nothing',
      using(make, async (s) => {
        assert.equal(failure(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget on an empty store').code, 'not_found');
        await apply(s.store, batchWrite());
        value(await s.store.insertReport(reportRow(), deviceRow()), 'insertReport');
        const before = await snapshot(s);
        assert.equal(failure(await s.store.forget(DEVICE_ID, STRANGER_VERIFIER), 'forget with a wrong verifier').code, 'not_found');
        assert.equal(failure(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER_2), "forget with another device's verifier").code, 'not_found');
        assert.equal(failure(await s.store.forget(DEVICE_ID_2, DEVICE_VERIFIER), 'forget another device').code, 'not_found');
        assert.equal(failure(await s.store.forget(DEVICE_ID, ''), 'forget with an empty verifier').code, 'not_found');
        assert.deepEqual(await snapshot(s), before);
        assert.equal((await expired(s.store, 'events')).length, 1, 'a failed forget deletes nothing');
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 1, 'a failed forget deletes no report');
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1, reports: 1 }),
        );
      }),
    );

    it(
      'deletes events reached through the device sessions even when they carry another device_id',
      using(make, async (s) => {
        // A pre-ownership row: an event in this device's session stamped with another device_id.
        await apply(s.store, batchWrite({ events: [eventRow(), eventRow({ seq: 2, device_id: DEVICE_ID_2, install_id: INSTALL_ID_3 })], errors: [] }));
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 2 }),
        );
        assert.deepEqual(await expired(s.store, 'events'), []);
      }),
    );

    it(
      'deletes every row of the device across all its installs and leaves other devices alone',
      using(make, async (s) => {
        const first = batchWrite({
          events: [eventRow(), eventRow({ seq: 2 })],
          errors: [errorRow(), errorRow({ error_id: ERROR_ID_2, session_id: null, seq: null })],
        });
        const reinstall = { install_id: INSTALL_ID_2 };
        const second = batchWrite({
          device: deviceRow({ last_seen: T0 + 1000 }),
          install: installRow({ ...reinstall, first_seen: T0 + 1000, last_seen: T0 + 1000 }),
          sessions: [sessionRow({ ...reinstall, session_id: SESSION_ID_2 })],
          events: [eventRow({ ...reinstall, session_id: SESSION_ID_2 })],
          errors: [errorRow({ ...reinstall, error_id: ERROR_ID_3, session_id: SESSION_ID_2 })],
        });
        const other = { install_id: INSTALL_ID_3, device_id: DEVICE_ID_2 };
        const otherWrite = batchWrite({
          device: deviceRow({ device_id: DEVICE_ID_2, verifier: DEVICE_VERIFIER_2 }),
          install: installRow(other),
          sessions: [sessionRow({ ...other, session_id: SESSION_ID_3 })],
          events: [eventRow({ ...other, session_id: SESSION_ID_3 })],
          errors: [errorRow({ ...other, error_id: ERROR_ID_4, session_id: SESSION_ID_3 })],
        });
        const otherReport = reportRow({ ...other, report_id: REPORT_ID_2, session_id: SESSION_ID_3 });
        for (const w of [first, second, otherWrite]) await apply(s.store, w);
        value(await s.store.insertReport(reportRow(), deviceRow()), 'insertReport');
        value(await s.store.insertReport(otherReport, otherWrite.device), 'insertReport');

        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 2, sessions: 2, events: 3, errors: 3, reports: 1 }),
        );
        assert.equal(failure(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'second forget').code, 'not_found');
        assert.deepEqual(await expired(s.store, 'events'), otherWrite.events.map(plain));
        assert.deepEqual(await expired(s.store, 'errors'), otherWrite.errors.map(plain));
        await expectRows(s, 'devices', [otherWrite.device]);
        await expectRows(s, 'installs', [otherWrite.install]);
        await expectRows(s, 'sessions', otherWrite.sessions);
        await expectRows(s, 'reports', [otherReport]);

        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID_2, DEVICE_VERIFIER_2), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1, reports: 1 }),
        );
        await expectEmpty(s);
      }),
    );
  });
}
