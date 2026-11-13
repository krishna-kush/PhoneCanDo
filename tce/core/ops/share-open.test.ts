import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { callHttp, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import { DAY_MS, SHARE_CODE, T0, UA, httpRequest, type HttpRequestOverrides } from '../../testkit/fixtures.ts';
import type { HttpResponse } from '../op.ts';
import { err, type TceResult } from '../result.ts';
import { shareOpenOp } from './share-open.ts';

function setup(store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store });
}

/** A browser opening /i/<code> (Sec-Fetch-Mode: navigate) unless `over.headers` says otherwise. */
function open(ctx: FakeCtx<MemoryStore>, code: string, over: HttpRequestOverrides = {}): Promise<TceResult<HttpResponse>> {
  const { headers, ...rest } = over;
  return callHttp(
    shareOpenOp,
    httpRequest({ method: 'GET', path: `/i/${code}`, params: { code }, ...rest, headers: { secFetchMode: 'navigate', ...headers } }),
    ctx,
  );
}

const HOME = (code: string) => ({ ok: true, value: { status: 302, location: `/?i=${code}`, headers: { 'Cache-Control': 'no-store' } } });

describe('share_open', () => {
  it('counts an open per UTC day and sends the browser home with the code', async () => {
    const ctx = setup();
    assert.deepEqual(await open(ctx, SHARE_CODE), HOME(SHARE_CODE));
    await open(ctx, SHARE_CODE, { headers: { userAgent: UA.desktop } });
    ctx.clock.set(T0 + DAY_MS);
    await open(ctx, SHARE_CODE);
    assert.deepEqual(ctx.store.tables.share_daily, [
      { day: '2026-11-01', code: SHARE_CODE, step: 'open', count: 2 },
      { day: '2026-11-02', code: SHARE_CODE, step: 'open', count: 1 },
    ]);
    // No identity and no page view: only the share count.
    assert.deepEqual(ctx.store.pagePoints, []);
    assert.deepEqual(ctx.store.tables.site_daily, []);
  });

  it('reads an upper-case code as its lower-case self', async () => {
    const ctx = setup();
    assert.deepEqual(await open(ctx, SHARE_CODE.toUpperCase()), HOME(SHARE_CODE));
    assert.equal(ctx.store.tables.share_daily[0]!.code, SHARE_CODE);
  });

  it('sends a path without a valid code home, counting nothing', async () => {
    const ctx = setup();
    for (const code of ['k7q2m9x', 'k7q2m9xa1', 'k7q2m9xl', 'k7q2m9x0', '%20']) {
      const r = await open(ctx, code);
      assert.deepEqual(r, { ok: true, value: { status: 302, location: '/', headers: { 'Cache-Control': 'no-store' } } }, code);
    }
    assert.deepEqual(ctx.store.tables.share_daily, []);
  });

  it('redirects without counting a link preview, a crawler, a HEAD or a caller over the rate limit', async () => {
    assert.equal(shareOpenOp.whenLimited, 'degrade');
    const ctx = setup();
    const cases: HttpRequestOverrides[] = [
      { headers: { secFetchMode: null, userAgent: 'WhatsApp/2.24.1 A' } },
      { headers: { secFetchMode: null, userAgent: 'TelegramBot (like TwitterBot)' } },
      { headers: { secFetchMode: 'navigate', userAgent: UA.bot } },
      { headers: { secFetchMode: 'no-cors' } },
      { method: 'HEAD' },
      { limited: true },
    ];
    for (const over of cases) assert.deepEqual(await open(ctx, SHARE_CODE, over), HOME(SHARE_CODE));
    assert.deepEqual(ctx.store.tables.share_daily, []);
  });

  it('still redirects when the count fails or throws', async () => {
    const store = createMemoryStore();
    const failing = setup({ ...store, countShareStep: async () => err('unavailable', 'db down') });
    assert.deepEqual(await open(failing, SHARE_CODE), HOME(SHARE_CODE));
    assert.equal(failing.log.entries[0]!.level, 'warn');
    const throwing = setup({
      ...store,
      countShareStep: async () => {
        throw new Error('boom');
      },
    });
    assert.deepEqual(await open(throwing, SHARE_CODE), HOME(SHARE_CODE));
    assert.equal(throwing.log.entries[0]!.level, 'error');
  });
});
