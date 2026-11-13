import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEVICE_ID, T0 } from '../testkit/fixtures.ts';
import { isShareCode, shareRowsOf } from './share.ts';

describe('share codes', () => {
  it('are 8 characters without look-alikes', () => {
    for (const ok of ['k7q2m9xa', 'abcdefgh', '23456789', 'zzzzzzzz']) assert.ok(isShareCode(ok), ok);
    for (const bad of ['k7q2m9x', 'k7q2m9xab', 'K7Q2M9XA', 'k7q2m9xl', 'k7q2m9xo', 'k7q2m9x0', 'k7q2m9x1', 'k7q2-9xa', '', null, 12345678]) {
      assert.ok(!isShareCode(bad), String(bad));
    }
  });
});

describe('shareRowsOf', () => {
  it('makes one link per code sent and an install from the first share.install only', () => {
    const rows = shareRowsOf(
      [
        { name: 'chat.open', props: { code: 'k7q2m9xa' }, ts: T0 },
        { name: 'share.sent', props: { code: 'k7q2m9xa' }, ts: T0 + 1 },
        { name: 'share.sent', props: { code: 'k7q2m9xa' }, ts: T0 + 2 },
        { name: 'share.install', props: { code: 'p3rt8wnb' }, ts: T0 + 3 },
        { name: 'share.install', props: { code: 'zz22hh44' }, ts: T0 + 4 },
        { name: 'share.sent', props: null, ts: T0 + 5 },
        { name: 'share.sent', props: { code: 'bad' }, ts: T0 + 6 },
      ],
      DEVICE_ID,
    );
    assert.deepEqual(rows, {
      shareLinks: [{ code: 'k7q2m9xa', device_id: DEVICE_ID, created: T0 + 1 }],
      shareInstalls: [{ device_id: DEVICE_ID, code: 'p3rt8wnb', ts: T0 + 3, day: '2026-11-01' }],
    });
  });

  it('adds nothing for a batch without share events', () => {
    assert.deepEqual(shareRowsOf([{ name: 'chat.open', props: null, ts: T0 }], DEVICE_ID), { shareLinks: [], shareInstalls: [] });
  });
});
