import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { callHttp, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import { DAY_MS, SITE_HOST, T0, UA, httpRequest, type HttpRequestOverrides } from '../../testkit/fixtures.ts';
import type { HttpResponse } from '../op.ts';
import { err, type TceResult } from '../result.ts';
import { apkUrl, downloadOp } from './download.ts';

function setup(store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store });
}

function download(ctx: FakeCtx<MemoryStore>, channel: string, over: HttpRequestOverrides = {}): Promise<TceResult<HttpResponse>> {
  return callHttp(downloadOp, httpRequest({ method: 'GET', path: `/dl/${channel}`, params: { channel }, ...over }), ctx);
}

const LITE = 'https://github.com/krishna-kush/PhoneCanDo/releases/download/v0.1.2/phonecando-0.1.2-lite-arm64.apk';

describe('download', () => {
  it('builds the GitHub release asset URL', () => {
    assert.equal(apkUrl('krishna-kush/PhoneCanDo', '0.1.2', 'lite'), LITE);
    assert.equal(
      apkUrl('krishna-kush/PhoneCanDo', '0.2.0', 'full'),
      'https://github.com/krishna-kush/PhoneCanDo/releases/download/v0.2.0/phonecando-0.2.0-full-arm64.apk',
    );
  });

  it('redirects with 302 and Cache-Control: no-store, and records the download', async () => {
    const ctx = setup();
    const r = await download(ctx, 'lite', { headers: { referer: 'https://www.reddit.com/r/androiddev/' } });
    assert.deepEqual(r, { ok: true, value: { status: 302, location: LITE, headers: { 'Cache-Control': 'no-store' } } });
    assert.deepEqual(ctx.store.downloadPoints, [
      { day: '2026-11-01', channel: 'lite', version: '0.1.2', country: 'IN', androidMajor: 16, refHost: 'www.reddit.com', uaClass: 'android' },
    ]);
    assert.deepEqual(ctx.store.tables.site_daily, [{ day: '2026-11-01', kind: 'download', key: 'lite', country: 'IN', count: 1 }]);
  });

  it('stamps the UTC day of the server clock on each download', async () => {
    const ctx = setup();
    ctx.clock.set(T0 - 1);
    await download(ctx, 'full');
    ctx.clock.set(T0 + DAY_MS);
    await download(ctx, 'full');
    await download(ctx, 'lite');
    assert.deepEqual(
      ctx.store.downloadPoints.map((p) => [p.day, p.channel]),
      [
        ['2026-10-31', 'full'],
        ['2026-11-02', 'full'],
        ['2026-11-02', 'lite'],
      ],
    );
    assert.deepEqual(await ctx.store.listSiteDaily('2026-11-01', '2026-11-02'), {
      ok: true,
      value: [
        { day: '2026-11-02', kind: 'download', key: 'full', country: 'IN', count: 1 },
        { day: '2026-11-02', kind: 'download', key: 'lite', country: 'IN', count: 1 },
      ],
    });
  });

  it('redirects HEAD requests without counting them', async () => {
    const ctx = setup();
    const r = await download(ctx, 'full', { method: 'HEAD' });
    assert.equal(r.ok && r.value.status, 302);
    assert.equal(ctx.store.downloadPoints.length, 0);
    assert.deepEqual(ctx.store.tables.site_daily, []);
  });

  it('degrades under the rate limit: redirects without counting', async () => {
    assert.equal(downloadOp.whenLimited, 'degrade');
    const ctx = setup();
    const r = await download(ctx, 'lite', { limited: true });
    assert.deepEqual(r, { ok: true, value: { status: 302, location: LITE, headers: { 'Cache-Control': 'no-store' } } });
    assert.deepEqual(ctx.store.downloadPoints, []);
    assert.deepEqual(ctx.store.tables.site_daily, []);
  });

  it('follows the configured release', async () => {
    const ctx = fakeCtx({ store: createMemoryStore(), config: { release: { repo: 'someone/fork', version: '9.9.9' } } });
    const r = await callHttp(downloadOp, httpRequest({ method: 'GET', path: '/dl/full', params: { channel: 'full' } }), ctx);
    assert.equal(r.ok && r.value.location, 'https://github.com/someone/fork/releases/download/v9.9.9/phonecando-9.9.9-full-arm64.apk');
    assert.equal(ctx.store.downloadPoints[0]!.version, '9.9.9');
  });

  it('records a same-site referrer as none and a desktop browser without an Android version', async () => {
    const ctx = setup();
    await download(ctx, 'full', { headers: { referer: `https://${SITE_HOST}/install`, userAgent: UA.desktop } });
    assert.deepEqual(ctx.store.downloadPoints, [
      { day: '2026-11-01', channel: 'full', version: '0.1.2', country: 'IN', androidMajor: null, refHost: null, uaClass: 'desktop' },
    ]);
  });

  it('answers not_found for any other channel', async () => {
    const ctx = setup();
    for (const channel of ['play', 'beta', 'LITE', '']) {
      const r = await download(ctx, channel);
      assert.equal(!r.ok && r.error.code, 'not_found', channel);
    }
    assert.deepEqual(ctx.store.downloadPoints, []);
  });

  it('still redirects when the point write fails or throws', async () => {
    const store = createMemoryStore();
    const failing = setup({ ...store, writeDownloadPoint: async () => err('unavailable', 'sink down') });
    const r1 = await download(failing, 'lite');
    assert.equal(r1.ok && r1.value.status, 302);
    assert.equal(failing.log.entries[0]!.level, 'warn');

    const throwing = setup({
      ...store,
      writeDownloadPoint: async () => {
        throw new Error('boom');
      },
    });
    const r2 = await download(throwing, 'lite');
    assert.equal(r2.ok && r2.value.location, LITE);
    assert.equal(throwing.log.entries[0]!.level, 'error');
  });
});
