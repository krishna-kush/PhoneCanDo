// Contract cases for device ownership: the first verifier pins a device, a
// write with another verifier or naming another device's session is refused
// whole, and a legacy null verifier is filled once.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEVICE_ID,
  DEVICE_ID_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  ERROR_ID_2,
  ERROR_ID_4,
  INSTALL_ID_2,
  INSTALL_ID_3,
  SESSION_ID_2,
  SESSION_ID_3,
  STRANGER_VERIFIER,
  T0,
  batchWrite,
  deviceRow,
  errorRow,
  eventRow,
  installRow,
  sessionRow,
} from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, counts, expectRows, expired, failure, identityOnly, snapshot, sorted, using, value } from './harness.ts';

/** Register the `ownership` cases. */
export function ownershipCases(make: Make): void {
  describe('ownership', () => {
    const other = { install_id: INSTALL_ID_3, device_id: DEVICE_ID_2 };

    it(
      'refuses a write whose verifier differs from the pinned one, and writes nothing of it',
      using(make, async (s) => {
        const victim = batchWrite();
        await apply(s.store, victim);
        const before = await snapshot(s);
        // An attacker who knows the victim's deviceId but not its proof.
        const attack = batchWrite({
          device: deviceRow({ verifier: STRANGER_VERIFIER, model: 'Attacker', last_seen: T0 + 5000 }),
          install: installRow({ install_id: INSTALL_ID_2, first_seen: T0 + 5000, last_seen: T0 + 5000 }),
          sessions: [sessionRow({ install_id: INSTALL_ID_2, session_id: SESSION_ID_2, received: T0 + 5000 })],
          events: [eventRow({ install_id: INSTALL_ID_2, session_id: SESSION_ID_2, received: T0 + 5000 })],
          errors: [errorRow({ install_id: INSTALL_ID_2, error_id: ERROR_ID_2, session_id: SESSION_ID_2, received: T0 + 5000 })],
        });
        assert.equal(failure(await s.store.applyBatch(attack), 'applyBatch with a foreign verifier').code, 'forbidden');
        // Also when the attacker sends no verifier at all.
        const unverified = identityOnly({ device: deviceRow({ verifier: null, last_seen: T0 + 6000 }) });
        assert.equal(failure(await s.store.applyBatch(unverified), 'applyBatch without a verifier').code, 'forbidden');
        assert.deepEqual(await snapshot(s), before);
        assert.deepEqual(sorted('events', await expired(s.store, 'events')), sorted('events', victim.events));
        assert.deepEqual(sorted('errors', await expired(s.store, 'errors')), sorted('errors', victim.errors));
        assert.equal(failure(await s.store.forget(DEVICE_ID, STRANGER_VERIFIER), 'forget with the attacker verifier').code, 'not_found');
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1 }),
        );
      }),
    );

    it(
      'accepts later writes with the pinned verifier, in or out of order, and never replaces it',
      using(make, async (s) => {
        await apply(s.store, identityOnly({ device: deviceRow({ last_seen: T0 + 1000, first_seen: T0 + 1000 }) }));
        // An older row (out of order) with the same verifier still merges.
        await apply(s.store, identityOnly({ device: deviceRow({ model: 'older' }) }));
        await apply(s.store, identityOnly({ device: deviceRow({ model: 'newest', first_seen: T0 + 2000, last_seen: T0 + 2000 }) }));
        await expectRows(s, 'devices', [deviceRow({ model: 'newest', first_seen: T0, last_seen: T0 + 2000 })]);
        assert.deepEqual(value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'), counts({ devices: 1, installs: 1 }));
      }),
    );

    it(
      'fills a null stored verifier (a row from before migration 0002) with the first non-null one',
      using(make, async (s) => {
        await apply(s.store, identityOnly({ device: deviceRow({ verifier: null }) }));
        await expectRows(s, 'devices', [deviceRow({ verifier: null })]);
        // A null verifier matches no proof.
        assert.equal(failure(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget a legacy device').code, 'not_found');
        await apply(s.store, identityOnly({ device: deviceRow({ last_seen: T0 + 1000 }) }));
        await expectRows(s, 'devices', [deviceRow({ last_seen: T0 + 1000 })]);
        // Now pinned: another verifier is refused and the pinned one stays.
        assert.equal(
          failure(await s.store.applyBatch(identityOnly({ device: deviceRow({ verifier: STRANGER_VERIFIER, last_seen: T0 + 2000 }) })), 'stranger').code,
          'forbidden',
        );
        await expectRows(s, 'devices', [deviceRow({ last_seen: T0 + 1000 })]);
        assert.deepEqual(value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'), counts({ devices: 1, installs: 1 }));
      }),
    );

    it(
      'refuses a write naming a session owned by another device, and writes nothing of it',
      using(make, async (s) => {
        const owner = batchWrite();
        await apply(s.store, owner);
        const before = await snapshot(s);
        // Device 2 (correctly verified for itself) claims device 1's session,
        // next to a session of its own: the whole write is refused.
        const hijack = batchWrite({
          device: deviceRow({ device_id: DEVICE_ID_2, verifier: DEVICE_VERIFIER_2 }),
          install: installRow(other),
          sessions: [sessionRow({ ...other, session_id: SESSION_ID_3 }), sessionRow({ ...other, received: T0 + 1000, boot_ms: 999 })],
          events: [eventRow({ ...other, session_id: SESSION_ID_3 }), eventRow({ ...other, seq: 7, received: T0 + 1000 })],
          errors: [errorRow({ ...other, error_id: ERROR_ID_4, session_id: SESSION_ID_3 })],
        });
        assert.equal(failure(await s.store.applyBatch(hijack), 'applyBatch with a foreign session').code, 'forbidden');
        assert.deepEqual(await snapshot(s), before);
        assert.deepEqual(sorted('events', await expired(s.store, 'events')), sorted('events', owner.events));
        assert.deepEqual(sorted('errors', await expired(s.store, 'errors')), sorted('errors', owner.errors));
        assert.equal(failure(await s.store.forget(DEVICE_ID_2, DEVICE_VERIFIER_2), 'forget device 2').code, 'not_found');
        // Without the stolen session, device 2's own write goes through.
        assert.deepEqual(
          await apply(s.store, { ...hijack, sessions: [hijack.sessions[0]!], events: [hijack.events[0]!] }),
          { sessions: 1, events: 1, errors: 1 },
        );
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1 }),
        );
      }),
    );
  });
}
