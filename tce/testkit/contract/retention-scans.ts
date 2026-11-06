// Contract cases for the retention cron's scans: listExpired (oldest rows below
// a cutoff, ordered, limited) and deleteRows (exact rows by primary key).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ArchiveRowMap } from '../../core/schema/rows.ts';
import { ERROR_ID, ERROR_ID_2, ERROR_ID_3, ERROR_ID_4, SESSION_ID_2, T0, batchWrite, errorRow, eventRow, sessionRow } from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, expired, plain, sorted, using, value } from './harness.ts';

/** Register the `listExpired` and `deleteRows` cases. */
export function retentionScanCases(make: Make): void {
  describe('listExpired', () => {
    it(
      'returns the oldest rows received before the cutoff, ordered by received, at most limit',
      using(make, async (s) => {
        const offsets = [30, 10, 20, 40];
        const errorIds = [ERROR_ID, ERROR_ID_2, ERROR_ID_3, ERROR_ID_4];
        const events = offsets.map((dt, i) => eventRow({ seq: i + 1, received: T0 + dt }));
        const errors = offsets.map((dt, i) => errorRow({ error_id: errorIds[i]!, seq: i + 10, received: T0 + dt }));
        await apply(s.store, batchWrite({ events, errors }));
        for (const [table, rows] of [
          ['events', events],
          ['errors', errors],
        ] as const) {
          assert.deepEqual(await expired(s.store, table, T0 + 40, 2), [rows[1], rows[2]], `${table} limit`);
          assert.deepEqual(await expired(s.store, table, T0 + 40, 10), [rows[1], rows[2], rows[0]], `${table} cutoff is exclusive`);
          assert.deepEqual(await expired(s.store, table, T0 + 41, 10), [rows[1], rows[2], rows[0], rows[3]], `${table} all`);
          assert.deepEqual(await expired(s.store, table, T0 + 10, 10), [], `${table} nothing older`);
        }
      }),
    );

    it(
      'returns an empty list when nothing is stored',
      using(make, async (s) => {
        assert.deepEqual(await expired(s.store, 'events'), []);
        assert.deepEqual(await expired(s.store, 'errors'), []);
      }),
    );
  });

  describe('deleteRows', () => {
    it(
      'deletes exactly the given rows by primary key and returns the count',
      using(make, async (s) => {
        const events = [eventRow(), eventRow({ seq: 2 }), eventRow({ session_id: SESSION_ID_2 })];
        const errors = [errorRow(), errorRow({ error_id: ERROR_ID_2 }), errorRow({ error_id: ERROR_ID_3 })];
        await apply(s.store, batchWrite({ sessions: [sessionRow(), sessionRow({ session_id: SESSION_ID_2 })], events, errors }));

        const rowsToDelete: ArchiveRowMap['events'][] = [events[0]!, events[2]!];
        assert.equal(value(await s.store.deleteRows('events', rowsToDelete), 'deleteRows'), 2);
        assert.deepEqual(await expired(s.store, 'events'), [plain(events[1]!)]);
        assert.equal(value(await s.store.deleteRows('events', [events[0]!]), 'deleteRows again'), 0);
        assert.equal(value(await s.store.deleteRows('events', []), 'deleteRows none'), 0);

        // Only the key matters: a stale copy of the row still deletes it.
        assert.equal(value(await s.store.deleteRows('errors', [{ ...errors[1]!, message: 'stale copy' }]), 'deleteRows'), 1);
        assert.deepEqual(sorted('errors', await expired(s.store, 'errors')), sorted('errors', [errors[0]!, errors[2]!]));
      }),
    );
  });
}
