// Contract cases for share links: the rows applyBatch adds (first device
// keeps a code; one install per device, never through its own link), the
// per-day open and download counts, shareStats' totals and `using`, and what
// forget removes.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { ShareLinkStats } from '../../core/schema/wire.ts';
import type { BatchWrite, Store } from '../../core/store.ts';
import {
  DAY_MS,
  DEVICE_ID,
  DEVICE_ID_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  INSTALL_ID_3,
  SESSION_ID_2,
  SESSION_ID_3,
  SHARE_CODE,
  SHARE_CODE_2,
  SHARE_CODE_3,
  T0,
  batchWrite,
  deviceRow,
  installRow,
  sessionRow,
  shareDailyRow,
  shareInstallRow,
  shareLinkRow,
} from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, counts, expectEmpty, expectRows, failure, using, value } from './harness.ts';

/** DEVICE_ID_2's own batch (its install, its session SESSION_ID_3) with the given share rows. */
function otherDevice(over: Partial<BatchWrite> = {}): BatchWrite {
  const other = { install_id: INSTALL_ID_3, device_id: DEVICE_ID_2 };
  return batchWrite({
    device: deviceRow({ device_id: DEVICE_ID_2, verifier: DEVICE_VERIFIER_2 }),
    install: installRow(other),
    sessions: [sessionRow({ ...other, session_id: SESSION_ID_3 })],
    events: [],
    errors: [],
    ...over,
  });
}

/** Zero counts for `code`. */
function zero(code: string): ShareLinkStats {
  return { code, opened: 0, downloaded: 0, installed: 0, using: 0, lastDay: null };
}

/** shareStats that must succeed. */
async function stats(store: Store, codes: readonly string[]): Promise<ShareLinkStats[]> {
  return value(await store.shareStats(codes), 'shareStats');
}

/** Register the `share links` cases. */
export function shareCases(make: Make): void {
  describe('share links', () => {
    it(
      'applyBatch keeps the first device to send a code; a code sent again by anyone adds nothing',
      using(make, async (s) => {
        await apply(s.store, batchWrite({ shareLinks: [shareLinkRow(), shareLinkRow({ code: SHARE_CODE_2 })] }));
        await apply(s.store, batchWrite({ shareLinks: [shareLinkRow({ created: T0 + 5 })] }));
        await apply(s.store, otherDevice({ shareLinks: [shareLinkRow({ device_id: DEVICE_ID_2, created: T0 + 9 })] }));
        await expectRows(s, 'share_links', [shareLinkRow(), shareLinkRow({ code: SHARE_CODE_2 })]);
        // The owner is still DEVICE_ID: DEVICE_ID_2 can install through it.
        await apply(s.store, otherDevice({ shareInstalls: [shareInstallRow()] }));
        assert.equal((await stats(s.store, [SHARE_CODE]))[0]?.installed, 1);
      }),
    );

    it(
      'records one install per device (the first link wins) and never one through the device’s own link',
      using(make, async (s) => {
        await apply(s.store, batchWrite({ shareLinks: [shareLinkRow()] }));
        // Its own link, in a later batch and in the same batch: nothing.
        await apply(s.store, batchWrite({ shareInstalls: [shareInstallRow({ device_id: DEVICE_ID })] }));
        await apply(
          s.store,
          batchWrite({ shareLinks: [shareLinkRow({ code: SHARE_CODE_2 })], shareInstalls: [shareInstallRow({ device_id: DEVICE_ID, code: SHARE_CODE_2 })] }),
        );
        await expectRows(s, 'share_installs', []);
        // Another device: first link wins, also for a code nobody registered yet.
        await apply(s.store, otherDevice({ shareInstalls: [shareInstallRow({ code: SHARE_CODE_3 })] }));
        await apply(s.store, otherDevice({ shareInstalls: [shareInstallRow({ ts: T0 + DAY_MS, day: '2026-11-02' })] }));
        await expectRows(s, 'share_installs', [shareInstallRow({ code: SHARE_CODE_3 })]);
        assert.deepEqual(
          (await stats(s.store, [SHARE_CODE, SHARE_CODE_2, SHARE_CODE_3])).map((x) => [x.code, x.installed]),
          [
            [SHARE_CODE, 0],
            [SHARE_CODE_2, 0],
            [SHARE_CODE_3, 1],
          ],
        );
      }),
    );

    it(
      'countShareStep adds per code, step and day; shareStats sums them with the last day, zeros for unknown codes',
      using(make, async (s) => {
        for (let i = 0; i < 3; i++) value(await s.store.countShareStep(shareDailyRow()), 'countShareStep');
        value(await s.store.countShareStep(shareDailyRow({ day: '2026-11-03' })), 'countShareStep');
        value(await s.store.countShareStep(shareDailyRow({ step: 'download', day: '2026-11-02' })), 'countShareStep');
        value(await s.store.countShareStep(shareDailyRow({ code: SHARE_CODE_2, step: 'download', count: 2 })), 'countShareStep');
        await expectRows(s, 'share_daily', [
          shareDailyRow({ count: 3 }),
          shareDailyRow({ day: '2026-11-03' }),
          shareDailyRow({ step: 'download', day: '2026-11-02' }),
          shareDailyRow({ code: SHARE_CODE_2, step: 'download', count: 2 }),
        ]);
        await expectEmpty(s, ['share_daily']);
        // Request order, each code once, an unknown code as zeros.
        assert.deepEqual(await stats(s.store, [SHARE_CODE_3, SHARE_CODE_2, SHARE_CODE, SHARE_CODE_2]), [
          zero(SHARE_CODE_3),
          { ...zero(SHARE_CODE_2), downloaded: 2, lastDay: '2026-11-01' },
          { ...zero(SHARE_CODE), opened: 4, downloaded: 1, lastDay: '2026-11-03' },
        ]);
      }),
    );

    it(
      'countShareStep refuses a malformed day',
      using(make, async (s) => {
        assert.equal(failure(await s.store.countShareStep(shareDailyRow({ day: '2026-11-1' })), 'countShareStep').code, 'bad_request');
        await expectEmpty(s);
      }),
    );

    it(
      'counts as using only an install whose device started a session on a later UTC day',
      using(make, async (s) => {
        // DEVICE_ID_2 installs through SHARE_CODE on 2026-11-01; its session started that day.
        await apply(s.store, otherDevice({ shareInstalls: [shareInstallRow({ ts: T0 + 3_600_000 })] }));
        let [row] = await stats(s.store, [SHARE_CODE]);
        assert.deepEqual(row, { ...zero(SHARE_CODE), installed: 1, lastDay: '2026-11-01' });
        // A session started on the next UTC day makes it a friend who came back.
        const later = { install_id: INSTALL_ID_3, device_id: DEVICE_ID_2, session_id: SESSION_ID_2, started: T0 + DAY_MS + 5 };
        await apply(s.store, otherDevice({ sessions: [sessionRow(later)] }));
        [row] = await stats(s.store, [SHARE_CODE]);
        assert.deepEqual(row, { ...zero(SHARE_CODE), installed: 1, using: 1, lastDay: '2026-11-01' });
      }),
    );

    it(
      'forget deletes the device’s links with their counts and installs, and its own install; nothing of other links',
      using(make, async (s) => {
        // DEVICE_ID owns SHARE_CODE (an open, an install by DEVICE_ID_2) and installed through SHARE_CODE_2.
        await apply(s.store, otherDevice({ shareLinks: [shareLinkRow({ code: SHARE_CODE_2, device_id: DEVICE_ID_2 })] }));
        await apply(s.store, batchWrite({ shareLinks: [shareLinkRow()], shareInstalls: [shareInstallRow({ device_id: DEVICE_ID, code: SHARE_CODE_2 })] }));
        await apply(s.store, otherDevice({ shareInstalls: [shareInstallRow()] }));
        value(await s.store.countShareStep(shareDailyRow()), 'countShareStep');
        value(await s.store.countShareStep(shareDailyRow({ code: SHARE_CODE_2 })), 'countShareStep');

        assert.deepEqual(
          value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget'),
          counts({ devices: 1, installs: 1, sessions: 1, events: 1, errors: 1, share_links: 1, share_daily: 1, share_installs: 2 }),
        );
        assert.deepEqual(await stats(s.store, [SHARE_CODE, SHARE_CODE_2]), [
          zero(SHARE_CODE),
          { ...zero(SHARE_CODE_2), opened: 1, lastDay: '2026-11-01' },
        ]);
        await expectRows(s, 'share_links', [shareLinkRow({ code: SHARE_CODE_2, device_id: DEVICE_ID_2 })]);
        await expectRows(s, 'share_installs', []);
      }),
    );
  });
}
