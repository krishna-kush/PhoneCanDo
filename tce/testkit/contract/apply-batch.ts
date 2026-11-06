// Contract cases for applyBatch: fresh inserts and counts, identity-only
// writes, replay idempotency, insert-or-ignore for events and errors, and
// all-or-nothing on a broken row.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { TceResult } from '../../core/result.ts';
import type { BatchCounts } from '../../core/store.ts';
import {
  DEVICE_ID,
  DEVICE_VERIFIER,
  ERROR_ID_2,
  SESSION_ID_2,
  T0,
  batchWrite,
  deviceRow,
  errorRow,
  eventRow,
  installRow,
  sessionRow,
} from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, counts, expectEmpty, expectRows, expired, failure, identityOnly, snapshot, sorted, using, value } from './harness.ts';

/** Register the `applyBatch` cases. */
export function applyBatchCases(make: Make): void {
  describe('applyBatch', () => {
    it(
      'inserts every row of a fresh write and counts them',
      using(make, async (s) => {
        const write = batchWrite({
          sessions: [sessionRow(), sessionRow({ session_id: SESSION_ID_2, started: T0 - 30_000, counters: null, boot_ms: null })],
          events: [
            eventRow(),
            eventRow({ seq: 2, name: 'terminal.open', props: '{"cols":80}' }),
            eventRow({ session_id: SESSION_ID_2, seq: 1 }),
          ],
          errors: [errorRow(), errorRow({ error_id: ERROR_ID_2, session_id: null, seq: null, kind: 'native' })],
        });
        assert.deepEqual(await apply(s.store, write), { sessions: 2, events: 3, errors: 2 });
        assert.deepEqual(sorted('events', await expired(s.store, 'events')), sorted('events', write.events));
        assert.deepEqual(sorted('errors', await expired(s.store, 'errors')), sorted('errors', write.errors));
        await expectRows(s, 'devices', [write.device]);
        await expectRows(s, 'installs', [write.install]);
        await expectRows(s, 'sessions', write.sessions);
        await expectEmpty(s, ['devices', 'installs', 'sessions', 'events', 'errors']);
      }),
    );

    it(
      'accepts a write with no sessions, events or errors',
      using(make, async (s) => {
        assert.deepEqual(await apply(s.store, identityOnly({})), { sessions: 0, events: 0, errors: 0 });
        await expectRows(s, 'devices', [deviceRow()]);
        await expectRows(s, 'installs', [installRow()]);
        assert.deepEqual(value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'), counts({ devices: 1, installs: 1 }));
      }),
    );

    it(
      'replaying the same write changes nothing and counts no new events or errors',
      using(make, async (s) => {
        const write = batchWrite({
          sessions: [sessionRow(), sessionRow({ session_id: SESSION_ID_2 })],
          events: [eventRow(), eventRow({ seq: 2 }), eventRow({ session_id: SESSION_ID_2 })],
          errors: [errorRow(), errorRow({ error_id: ERROR_ID_2, session_id: null, seq: null })],
        });
        assert.deepEqual(await apply(s.store, write), { sessions: 2, events: 3, errors: 2 });
        const before = await snapshot(s);
        const events = sorted('events', await expired(s.store, 'events'));
        const errors = sorted('errors', await expired(s.store, 'errors'));
        // Same objects, then fresh copies: idempotency is by key, not identity.
        assert.deepEqual(await apply(s.store, write), { sessions: 2, events: 0, errors: 0 });
        assert.deepEqual(await apply(s.store, structuredClone(write)), { sessions: 2, events: 0, errors: 0 });
        assert.deepEqual(await snapshot(s), before);
        assert.deepEqual(sorted('events', await expired(s.store, 'events')), events);
        assert.deepEqual(sorted('errors', await expired(s.store, 'errors')), errors);
        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 2, events: 3, errors: 2 }),
        );
      }),
    );

    it(
      'keeps the first event and error for a repeated key (insert-or-ignore)',
      using(make, async (s) => {
        await apply(s.store, batchWrite({ events: [eventRow()], errors: [errorRow({ message: 'first' })] }));
        const later = { received: T0 + 1000 };
        const second = await apply(
          s.store,
          batchWrite({
            sessions: [sessionRow(later)],
            events: [eventRow({ ...later, name: 'terminal.open', props: '{"x":1}' }), eventRow({ ...later, seq: 2 })],
            errors: [errorRow({ ...later, message: 'second' }), errorRow({ ...later, error_id: ERROR_ID_2 })],
          }),
        );
        assert.deepEqual(second, { sessions: 1, events: 1, errors: 1 });
        assert.deepEqual(
          sorted('events', await expired(s.store, 'events')),
          sorted('events', [eventRow(), eventRow({ ...later, seq: 2 })]),
        );
        assert.deepEqual(
          sorted('errors', await expired(s.store, 'errors')),
          sorted('errors', [errorRow({ message: 'first' }), errorRow({ ...later, error_id: ERROR_ID_2 })]),
        );
      }),
    );

    it(
      'is all-or-nothing: a write whose last row breaks a NOT NULL column stores nothing',
      using(make, async (s) => {
        const broken = batchWrite({
          errors: [errorRow(), errorRow({ error_id: ERROR_ID_2, class_name: null as unknown as string })],
        });
        let r: TceResult<BatchCounts>;
        try {
          r = await s.store.applyBatch(broken);
        } catch (e) {
          assert.fail(`applyBatch threw instead of returning a TceResult: ${String(e)}`);
        }
        failure(r, 'applyBatch with a NULL class_name');
        assert.deepEqual(await expired(s.store, 'events'), []);
        assert.deepEqual(await expired(s.store, 'errors'), []);
        assert.equal(failure(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget').code, 'not_found');
        await expectEmpty(s);
      }),
    );
  });
}
