// Contract cases for usage(), which GET /v1/health reports: a well-formed
// StoreUsage, a fresh store that is not pausing ingest, and the oldest kept
// `received` per retained table (what the limit check compares with the
// promised retention while deletion is switched off).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { StoreUsage } from '../../core/store.ts';
import { ERROR_ID_2, T0, batchWrite, deviceRow, errorRow, eventRow, pagePoint, reportRow } from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, using, value } from './harness.ts';

/** Asserts `u` has exactly StoreUsage's fields with sane values. */
function assertWellFormed(u: StoreUsage, when: string): void {
  assert.deepEqual(Object.keys(u).sort(), ['dbBytes', 'ingestPaused', 'oldestReceived'], `${when}: fields`);
  assert.equal(typeof u.ingestPaused, 'boolean', `${when}: ingestPaused`);
  if (u.dbBytes !== null) assert.ok(Number.isSafeInteger(u.dbBytes) && u.dbBytes >= 0, `${when}: dbBytes is ${String(u.dbBytes)}`);
  assert.deepEqual(Object.keys(u.oldestReceived).sort(), ['errors', 'events', 'reports'], `${when}: oldestReceived fields`);
  for (const [table, t] of Object.entries(u.oldestReceived)) {
    if (t !== null) assert.ok(Number.isSafeInteger(t), `${when}: oldestReceived.${table} is ${String(t)}`);
  }
}

/** Register the `usage` cases. */
export function usageCases(make: Make): void {
  describe('usage', () => {
    it(
      'reports a well-formed StoreUsage, not paused while the store is far below its limit',
      using(make, async (s) => {
        const fresh = value(await s.store.usage(), 'usage on a fresh store');
        assertWellFormed(fresh, 'fresh store');
        assert.equal(fresh.ingestPaused, false, 'a fresh store is nowhere near its limit');
        await apply(s.store, batchWrite());
        value(await s.store.writePagePoint(pagePoint()), 'writePagePoint');
        const after = value(await s.store.usage(), 'usage after writes');
        assertWellFormed(after, 'after writes');
        assert.equal(after.ingestPaused, false);
      }),
    );

    it(
      'reports the oldest kept received per table: null when empty, the minimum after inserts, site_daily ignored',
      using(make, async (s) => {
        assert.deepEqual(value(await s.store.usage(), 'empty').oldestReceived, { events: null, errors: null, reports: null });

        value(await s.store.writePagePoint(pagePoint()), 'a page view adds no retained row');
        assert.deepEqual(value(await s.store.usage(), 'after a page view').oldestReceived, { events: null, errors: null, reports: null });

        await apply(
          s.store,
          batchWrite({
            events: [eventRow({ seq: 1, received: T0 + 500 }), eventRow({ seq: 2, received: T0 + 100 })],
            errors: [errorRow({ received: T0 + 300 }), errorRow({ error_id: ERROR_ID_2, received: T0 + 700 })],
          }),
        );
        value(await s.store.insertReport(reportRow({ received: T0 + 900 }), deviceRow()), 'insertReport');

        assert.deepEqual(value(await s.store.usage(), 'after inserts').oldestReceived, {
          events: T0 + 100,
          errors: T0 + 300,
          reports: T0 + 900,
        });
      }),
    );
  });
}
