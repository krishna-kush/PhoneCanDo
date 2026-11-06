// Contract cases for the merge rules: how repeated device, install and session
// rows combine in any arrival order, and that ties go to the incoming row.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEVICE_ID, DEVICE_VERIFIER, DRM_ID, DRM_ID_2, T0, deviceRow, eventRow, installRow, sessionRow } from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, counts, expectRows, identityOnly, needsDump, using, value } from './harness.ts';

/** Register the `merge rules` cases. */
export function mergeRuleCases(make: Make): void {
  describe('merge rules', () => {
    const olderDevice = deviceRow({ drm_id: DRM_ID, first_seen: T0, last_seen: T0 });
    const newerDevice = deviceRow({
      hw_hash: 'c4'.repeat(32),
      drm_id: null,
      manufacturer: 'Google LLC',
      model: 'Pixel 8 Pro',
      sdk_int: 37,
      abi: 'x86_64',
      ram_gb: 12,
      locale: 'hi-IN',
      country: 'US',
      asn: 15169,
      tester: 1,
      first_seen: T0 + 1000,
      last_seen: T0 + 1000,
    });
    // first_seen = min, last_seen = max, the rest from the newer row, drm_id = last non-null.
    const mergedDevice = { ...newerDevice, first_seen: T0, last_seen: T0 + 1000, drm_id: DRM_ID };

    for (const [label, order] of [
      ['in order', [olderDevice, newerDevice]],
      ['out of order', [newerDevice, olderDevice]],
    ] as const) {
      it(
        `merges devices ${label}: first_seen min, last_seen max, fields from the newer row, drm_id keeps the last non-null`,
        using(make, async (s, t) => {
          for (const device of order) assert.deepEqual(await apply(s.store, identityOnly({ device })), { sessions: 0, events: 0, errors: 0 });
          if (s.dump) {
            await expectRows(s, 'devices', [mergedDevice]);
            const newest = deviceRow({ ...newerDevice, drm_id: DRM_ID_2, first_seen: T0 + 2000, last_seen: T0 + 2000 });
            await apply(s.store, identityOnly({ device: newest }));
            await expectRows(s, 'devices', [{ ...newest, first_seen: T0 }]);
          }
          assert.deepEqual(value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'), counts({ devices: 1, installs: 1 }));
          needsDump(s, t);
        }),
      );
    }

    const olderInstall = installRow({
      channel: 'lite',
      install_source: 'com.android.chrome',
      first_version: '0.1.1',
      last_version: '0.1.1',
      last_version_code: 11,
      first_seen: T0,
      last_seen: T0,
    });
    const newerInstall = installRow({
      channel: 'full',
      install_source: 'com.phonecando.app',
      first_version: '0.1.2',
      last_version: '0.1.2',
      last_version_code: 12,
      first_seen: T0 + 5000,
      last_seen: T0 + 5000,
    });
    // first_* from the older row, last_* and the rest from the newer.
    const mergedInstall = { ...newerInstall, first_version: '0.1.1', first_seen: T0 };

    for (const [label, order] of [
      ['in order', [olderInstall, newerInstall]],
      ['out of order', [newerInstall, olderInstall]],
    ] as const) {
      it(
        `merges installs ${label}: first_* from the older row, last_* and the rest from the newer`,
        using(make, async (s, t) => {
          for (const install of order) await apply(s.store, identityOnly({ install }));
          await expectRows(s, 'installs', [mergedInstall]);
          assert.deepEqual(value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'), counts({ devices: 1, installs: 1 }));
          needsDump(s, t);
        }),
      );
    }

    const s1 = sessionRow({
      received: T0,
      started: T0 - 60_000,
      ended: null,
      boot_ms: 1800,
      engine_ok: 1,
      engine_exit_code: null,
      engine_stderr_tail: null,
      low_memory_trims: 0,
      battery_opt_ignored: 1,
      fg_service_ok: null,
      a11y_on: 0,
      counters: '{"a":1}',
      country: 'IN',
    });
    const s2 = sessionRow({
      received: T0 + 1000,
      started: T0 - 59_000,
      ended: T0 + 500,
      boot_ms: null,
      engine_ok: 0,
      engine_exit_code: 137,
      engine_stderr_tail: 'killed',
      low_memory_trims: 2,
      battery_opt_ignored: null,
      fg_service_ok: 1,
      a11y_on: null,
      counters: '{"a":2}',
      country: null,
    });
    const s3 = sessionRow({
      received: T0 + 2000,
      version: '0.1.3',
      version_code: 13,
      channel: 'full',
      started: T0 - 58_000,
      ended: T0 + 400,
      boot_ms: null,
      engine_ok: null,
      engine_exit_code: null,
      engine_stderr_tail: null,
      low_memory_trims: null,
      battery_opt_ignored: null,
      fg_service_ok: null,
      a11y_on: null,
      counters: null,
      country: null,
    });
    // started = min, ended = max non-null, nullable fields = newest (by received) non-null,
    // received = max; version/version_code/channel come from the first write
    // and are never rewritten (s3, the newest, carries another build).
    const mergedSession = {
      ...s1,
      started: T0 - 60_000,
      ended: T0 + 500,
      boot_ms: 1800,
      engine_ok: 0,
      engine_exit_code: 137,
      engine_stderr_tail: 'killed',
      low_memory_trims: 2,
      battery_opt_ignored: 1,
      fg_service_ok: 1,
      a11y_on: 0,
      counters: '{"a":2}',
      country: 'IN',
      received: T0 + 2000,
    };

    for (const [label, order] of [
      ['in order', [s1, s2, s3]],
      ['in reverse', [s3, s2, s1]],
      ['shuffled', [s2, s3, s1]],
    ] as const) {
      it(
        `merges sessions ${label}: started min, ended max non-null, nullable fields keep the newest non-null`,
        using(make, async (s, t) => {
          for (const session of order) {
            assert.deepEqual(await apply(s.store, identityOnly({ sessions: [session] })), { sessions: 1, events: 0, errors: 0 });
          }
          const first = order[0];
          await expectRows(s, 'sessions', [
            { ...mergedSession, version: first.version, version_code: first.version_code, channel: first.channel },
          ]);
          assert.deepEqual(
            value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
            counts({ devices: 1, installs: 1, sessions: 1 }),
          );
          needsDump(s, t);
        }),
      );
    }

    it(
      'keeps the build a session ran when a later minimal row (made for events by an updated app) names another',
      using(make, async (s, t) => {
        const stamped = sessionRow({ received: T0, version: '0.1.2', version_code: 12, channel: 'lite', ended: T0 - 1000 });
        await apply(s.store, identityOnly({ sessions: [stamped] }));
        // The batch op's minimal session: batch app build, no optional fields, newer received.
        const minimal = sessionRow({
          received: T0 + 60_000,
          version: '0.1.3',
          version_code: 13,
          channel: 'full',
          started: T0 - 70_000,
          ended: null,
          boot_ms: null,
          engine_ok: null,
          engine_exit_code: null,
          engine_stderr_tail: null,
          low_memory_trims: null,
          battery_opt_ignored: null,
          fg_service_ok: null,
          a11y_on: null,
          counters: null,
          country: 'US',
        });
        const later = { received: T0 + 60_000 };
        assert.deepEqual(
          await apply(s.store, identityOnly({ sessions: [minimal], events: [eventRow({ ...later, seq: 9 })] })),
          { sessions: 1, events: 1, errors: 0 },
        );
        await expectRows(s, 'sessions', [{ ...stamped, started: T0 - 70_000, country: 'US', received: T0 + 60_000 }]);
        needsDump(s, t);
      }),
    );

    it(
      'breaks ties toward the incoming row (same server time)',
      using(make, async (s, t) => {
        await apply(s.store, identityOnly({ device: deviceRow({ model: 'first' }), sessions: [sessionRow({ boot_ms: 1 })] }));
        await apply(s.store, identityOnly({ device: deviceRow({ model: 'second' }), sessions: [sessionRow({ boot_ms: 2 })] }));
        await expectRows(s, 'devices', [deviceRow({ model: 'second' })]);
        await expectRows(s, 'sessions', [sessionRow({ boot_ms: 2 })]);
        needsDump(s, t);
      }),
    );
  });
}
