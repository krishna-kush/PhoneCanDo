// Contract cases for crash reports: retention (countReportsSince,
// deleteExpiredReports) and insertReport's ownership, device merge,
// insert-or-ignore and all-or-nothing rules.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TceResult } from '../../core/result.ts';
import {
  DEVICE_ID,
  DEVICE_ID_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  DRM_ID,
  INSTALL_ID_3,
  REPORT_ID,
  REPORT_ID_2,
  STRANGER_VERIFIER,
  T0,
  batchWrite,
  deviceRow,
  installRow,
  reportRow,
} from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, counts, expectEmpty, expectRows, failure, identityOnly, snapshot, using, value } from './harness.ts';

/** Register the `report retention` and `insertReport` cases. */
export function reportCases(make: Make): void {
  describe('report retention', () => {
    const reports = () => [
      reportRow({ received: T0 }),
      reportRow({ report_id: REPORT_ID_2, received: T0 + 10 }),
    ];

    it(
      'countReportsSince counts reports received at or after the cutoff',
      using(make, async (s) => {
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince on an empty store'), 0);
        for (const r of reports()) value(await s.store.insertReport(r, deviceRow()), 'insertReport');
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 2);
        assert.equal(value(await s.store.countReportsSince(T0), 'countReportsSince'), 2, 'the cutoff is inclusive');
        assert.equal(value(await s.store.countReportsSince(T0 + 1), 'countReportsSince'), 1);
        assert.equal(value(await s.store.countReportsSince(T0 + 10), 'countReportsSince'), 1);
        assert.equal(value(await s.store.countReportsSince(T0 + 11), 'countReportsSince'), 0);
      }),
    );

    it(
      'deleteExpiredReports deletes reports received before the cutoff and returns how many',
      using(make, async (s) => {
        assert.equal(value(await s.store.deleteExpiredReports(T0 + 100), 'deleteExpiredReports on an empty store'), 0);
        const [older, newer] = reports();
        for (const r of [older!, newer!]) value(await s.store.insertReport(r, deviceRow()), 'insertReport');
        assert.equal(value(await s.store.deleteExpiredReports(T0), 'deleteExpiredReports'), 0, 'the cutoff is exclusive');
        assert.equal(value(await s.store.deleteExpiredReports(T0 + 10), 'deleteExpiredReports'), 1);
        await expectRows(s, 'reports', [newer!]);
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 1);
        assert.equal(value(await s.store.deleteExpiredReports(T0 + 11), 'deleteExpiredReports'), 1);
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 0);
        // Retention deletes reports only; the device row the reports pinned stays.
        await expectRows(s, 'devices', [deviceRow()]);
        await expectEmpty(s, ['devices']);
        // A deleted report_id can be inserted again.
        assert.deepEqual(value(await s.store.insertReport(reportRow({ report_id: REPORT_ID }), deviceRow()), 'insertReport'), { inserted: true });
      }),
    );
  });

  describe('insertReport', () => {
    it(
      'refuses a report whose device verifier is not the pinned one, and writes nothing (not even the device merge)',
      using(make, async (s) => {
        await apply(s.store, batchWrite());
        const before = await snapshot(s);
        for (const verifier of [STRANGER_VERIFIER, DEVICE_VERIFIER_2, '', null]) {
          const impostor = deviceRow({ verifier, model: 'Impostor', last_seen: T0 + 5000 });
          const r = await s.store.insertReport(reportRow({ note: 'impostor' }), impostor);
          assert.equal(failure(r, `insertReport with ${verifier || 'no'} verifier`).code, 'forbidden');
        }
        assert.deepEqual(await snapshot(s), before);
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 0);
        await expectRows(s, 'reports', []);
        await expectRows(s, 'devices', [deviceRow()]);
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1 }),
        );
      }),
    );

    it(
      'pins a never-seen device to the report verifier, so forget with the right proof deletes that report',
      using(make, async (s) => {
        const otherDevice = deviceRow({ device_id: DEVICE_ID_2, verifier: DEVICE_VERIFIER_2 });
        const other = reportRow({ install_id: INSTALL_ID_3, device_id: DEVICE_ID_2 });
        assert.deepEqual(value(await s.store.insertReport(other, otherDevice), 'insertReport'), { inserted: true });
        await expectRows(s, 'reports', [other]);
        await expectRows(s, 'devices', [otherDevice]);
        await expectEmpty(s, ['reports', 'devices']);
        // The report pinned the verifier: another one is refused for reports and batches alike.
        const stranger = deviceRow({ device_id: DEVICE_ID_2, verifier: STRANGER_VERIFIER, last_seen: T0 + 1000 });
        assert.equal(failure(await s.store.insertReport(reportRow({ ...other, report_id: REPORT_ID_2 }), stranger), 'stranger report').code, 'forbidden');
        assert.equal(failure(await s.store.applyBatch(identityOnly({ device: stranger, install: installRow({ install_id: INSTALL_ID_3, device_id: DEVICE_ID_2 }) })), 'stranger batch').code, 'forbidden');
        assert.equal(failure(await s.store.forget(DEVICE_ID_2, STRANGER_VERIFIER), 'forget with a wrong verifier').code, 'not_found');
        await expectRows(s, 'devices', [otherDevice]);
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 1);
        // Delete my data from a phone that only ever sent a report.
        assert.deepEqual(value(await s.store.forget(DEVICE_ID_2, DEVICE_VERIFIER_2), 'forget'), counts({ devices: 1, reports: 1 }));
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 0);
        await expectEmpty(s);
      }),
    );

    it(
      'merges the device by the applyBatch rules and fills a null stored verifier (a row from before migration 0002)',
      using(make, async (s) => {
        await apply(s.store, identityOnly({ device: deviceRow({ verifier: null }) }));
        const newer = deviceRow({ model: 'Pixel 9', drm_id: DRM_ID, last_seen: T0 + 1000, first_seen: T0 + 1000 });
        assert.deepEqual(value(await s.store.insertReport(reportRow(), newer), 'insertReport'), { inserted: true });
        await expectRows(s, 'devices', [{ ...newer, first_seen: T0 }]);
        // An older row merges like applyBatch's: first_seen min, the rest from the newer row.
        const older = deviceRow({ model: 'older', first_seen: T0 - 1000, last_seen: T0 - 1000 });
        assert.deepEqual(value(await s.store.insertReport(reportRow({ report_id: REPORT_ID_2 }), older), 'insertReport'), { inserted: true });
        await expectRows(s, 'devices', [{ ...newer, first_seen: T0 - 1000 }]);
        // Now pinned: another verifier is refused.
        assert.equal(failure(await s.store.insertReport(reportRow({ report_id: REPORT_ID_2 }), deviceRow({ verifier: STRANGER_VERIFIER })), 'stranger').code, 'forbidden');
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, reports: 2 }),
        );
      }),
    );

    it(
      'inserts once and ignores a repeated report_id',
      using(make, async (s) => {
        assert.deepEqual(value(await s.store.insertReport(reportRow(), deviceRow()), 'insertReport'), { inserted: true });
        assert.deepEqual(
          value(await s.store.insertReport(reportRow({ note: 'changed', received: T0 + 1 }), deviceRow()), 'insertReport'),
          { inserted: false },
        );
        const bare = reportRow({ report_id: REPORT_ID_2, session_id: null, note: null, log_tail: null });
        assert.deepEqual(value(await s.store.insertReport(bare, deviceRow()), 'insertReport'), { inserted: true });
        await expectRows(s, 'reports', [reportRow(), bare]);
        await expectRows(s, 'devices', [deviceRow()]);
        await apply(s.store, batchWrite());
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1, reports: 2 }),
        );
      }),
    );

    it(
      'is all-or-nothing: a broken report row or device row writes neither',
      using(make, async (s) => {
        const brokenReport = reportRow({ version: null as unknown as string });
        const brokenDevice = deviceRow({ model: null as unknown as string });
        for (const [row, device, what] of [
          [brokenReport, deviceRow(), 'a NULL report version'],
          [reportRow(), brokenDevice, 'a NULL device model'],
        ] as const) {
          let r: TceResult<{ inserted: boolean }>;
          try {
            r = await s.store.insertReport(row, device);
          } catch (e) {
            assert.fail(`insertReport threw instead of returning a TceResult: ${String(e)}`);
          }
          failure(r, `insertReport with ${what}`);
        }
        assert.equal(value(await s.store.countReportsSince(0), 'countReportsSince'), 0);
        assert.equal(failure(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget').code, 'not_found');
        await expectEmpty(s);
      }),
    );
  });
}
