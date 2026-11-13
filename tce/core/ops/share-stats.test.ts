import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { callHttp, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import { SHARE_CODE, SHARE_CODE_2, httpRequest, shareDailyRow } from '../../testkit/fixtures.ts';
import type { HttpResponse } from '../op.ts';
import { err, type TceResult } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import { parseShareStats, shareStatsOp } from './share-stats.ts';

function setup(store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store });
}

function ask(ctx: FakeCtx<MemoryStore>, body: unknown): Promise<TceResult<HttpResponse>> {
  return callHttp(shareStatsOp, httpRequest({ path: '/v1/share/stats', body }), ctx);
}

describe('share_stats parse', () => {
  it('accepts 1..100 codes and asks each once, in order', () => {
    assert.deepEqual(parseShareStats({ codes: [SHARE_CODE_2, SHARE_CODE, SHARE_CODE_2] }), {
      ok: true,
      value: { codes: [SHARE_CODE_2, SHARE_CODE] },
    });
    const many = Array.from({ length: LIMITS.shareStatsCodes }, () => SHARE_CODE);
    assert.equal(parseShareStats({ codes: many }).ok, true);
  });

  it('rejects a missing, empty, oversized or malformed list', () => {
    const code = (body: unknown) => {
      const r = parseShareStats(body);
      return r.ok ? 'ok' : `${r.error.code}:${r.error.field ?? ''}`;
    };
    assert.equal(code(null), 'bad_request:');
    assert.equal(code({}), 'bad_request:codes');
    assert.equal(code({ codes: [] }), 'bad_request:codes');
    assert.equal(code({ codes: SHARE_CODE }), 'bad_request:codes');
    assert.equal(code({ codes: [SHARE_CODE, 'K7Q2M9XA'] }), 'bad_request:codes');
    assert.equal(code({ codes: [SHARE_CODE, 7] }), 'bad_request:codes');
    assert.equal(code({ codes: Array.from({ length: LIMITS.shareStatsCodes + 1 }, () => SHARE_CODE) }), 'too_large:codes');
  });

  it('fits 100 codes in the small body cap', () => {
    const body = JSON.stringify({ codes: Array.from({ length: LIMITS.shareStatsCodes }, () => SHARE_CODE) });
    assert.ok(new TextEncoder().encode(body).byteLength <= shareStatsOp.maxBodyBytes);
  });
});

describe('share_stats run', () => {
  it('answers each code’s counts, zeros for a code never seen', async () => {
    const ctx = setup();
    await ctx.store.countShareStep(shareDailyRow());
    await ctx.store.countShareStep(shareDailyRow({ step: 'download', day: '2026-11-02' }));
    const r = await ask(ctx, { codes: [SHARE_CODE, SHARE_CODE_2] });
    assert.deepEqual(r, {
      ok: true,
      value: {
        status: 200,
        json: {
          links: [
            { code: SHARE_CODE, opened: 1, downloaded: 1, installed: 0, using: 0, lastDay: '2026-11-02' },
            { code: SHARE_CODE_2, opened: 0, downloaded: 0, installed: 0, using: 0, lastDay: null },
          ],
        },
      },
    });
  });

  it('passes a store failure through', async () => {
    const ctx = setup({ ...createMemoryStore(), shareStats: async () => err('unavailable', 'db down') });
    const r = await ask(ctx, { codes: [SHARE_CODE] });
    assert.equal(!r.ok && r.error.code, 'unavailable');
  });
});
