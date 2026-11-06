import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { callHttp, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import { DAY_MS, SITE_HOST, SITE_ORIGIN, T0, UA, hitRequest, httpRequest, type HttpRequestOverrides } from '../../testkit/fixtures.ts';
import { err } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import { hitOp, originAllowed } from './hit.ts';
import type { HttpResponse } from '../op.ts';
import type { TceResult } from '../result.ts';

function setup(store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store });
}

function hit(ctx: FakeCtx<MemoryStore>, body: unknown, over: HttpRequestOverrides = {}): Promise<TceResult<HttpResponse>> {
  return callHttp(
    hitOp,
    httpRequest({ ...over, path: '/api/hit', body, headers: { origin: SITE_ORIGIN, ...over.headers } }),
    ctx,
  );
}

describe('hit origin rules', () => {
  const config = {
    release: { repo: 'r/r', version: '1' },
    githubToken: null,
    allowedOrigins: [SITE_ORIGIN, 'http://127.0.0.1:8787'],
    retentionEnabled: false,
  };

  it('accepts configured origins and the request host over https', () => {
    assert.equal(originAllowed(SITE_ORIGIN, SITE_HOST, config), true);
    assert.equal(originAllowed('http://127.0.0.1:8787', '127.0.0.1:8787', config), true);
    assert.equal(originAllowed('https://phonecando.krishnakumarkush.workers.dev', 'phonecando.krishnakumarkush.workers.dev', config), true);
  });

  it('rejects missing, opaque, foreign and plain-http own origins', () => {
    assert.equal(originAllowed(null, SITE_HOST, config), false);
    assert.equal(originAllowed('null', SITE_HOST, config), false);
    assert.equal(originAllowed('https://evil.example', SITE_HOST, config), false);
    assert.equal(originAllowed('http://phonecando.krishnakumarkush.workers.dev', 'phonecando.krishnakumarkush.workers.dev', config), false);
    assert.equal(originAllowed('https://evil.example', null, config), false);
  });

  it('answers forbidden for a cross-origin beacon and writes nothing', async () => {
    const ctx = setup();
    for (const origin of [null, 'https://evil.example']) {
      const r = await hit(ctx, hitRequest(), { headers: { origin } });
      assert.equal(r.ok, false);
      assert.equal(!r.ok && r.error.code, 'forbidden');
    }
    assert.deepEqual(ctx.store.pagePoints, []);
  });
});

describe('hit run', () => {
  it('stores path, referrer host, country and UA class, and answers 204', async () => {
    const ctx = setup();
    const r = await hit(ctx, hitRequest());
    assert.deepEqual(r, { ok: true, value: { status: 204 } });
    assert.deepEqual(ctx.store.pagePoints, [{ day: '2026-11-01', path: '/install', refHost: 'www.google.com', country: 'IN', uaClass: 'android' }]);
  });

  it('stamps the UTC day of the server clock, and the store counts the view in site_daily', async () => {
    const ctx = setup();
    ctx.clock.set(T0 - 1); // 2026-10-31T23:59:59.999Z
    await hit(ctx, { path: '/a' });
    ctx.clock.set(T0); // midnight UTC starts the next day
    await hit(ctx, { path: '/a' });
    ctx.clock.set(T0 + DAY_MS - 1);
    await hit(ctx, { path: '/a' }, { headers: { userAgent: UA.bot } });
    assert.deepEqual(
      ctx.store.pagePoints.map((p) => p.day),
      ['2026-10-31', '2026-11-01', '2026-11-01'],
    );
    assert.deepEqual(await ctx.store.listSiteDaily('2026-10-01', '2026-11-30'), {
      ok: true,
      value: [
        { day: '2026-10-31', kind: 'view', key: '/a', country: 'IN', count: 1 },
        { day: '2026-11-01', kind: 'view', key: '/a', country: 'IN', count: 2 },
      ],
    });
  });

  it('counts a view without an edge country under country ""', async () => {
    const ctx = fakeCtx({ store: createMemoryStore(), edge: { country: null } });
    await hit(ctx, { path: '/' });
    assert.equal(ctx.store.pagePoints[0]!.country, null);
    assert.deepEqual(ctx.store.tables.site_daily, [{ day: '2026-11-01', kind: 'view', key: '/', country: '', count: 1 }]);
  });

  it('strips query and fragment and caps the path', async () => {
    const ctx = setup();
    await hit(ctx, { path: '/docs?utm_source=x#faq' });
    await hit(ctx, { path: '/#top' });
    await hit(ctx, { path: '/' + 'p'.repeat(500) });
    assert.deepEqual(
      ctx.store.pagePoints.map((p) => p.path),
      ['/docs', '/', '/' + 'p'.repeat(LIMITS.pathLength - 1)],
    );
  });

  it('rejects a path that does not start with a slash, and broken bodies', async () => {
    const ctx = setup();
    for (const [body, field] of [
      [{ path: 'install' }, 'path'],
      [{ path: 'https://evil.example/' }, 'path'],
      [{}, 'path'],
      [{ path: '/', ref: 42 }, 'ref'],
    ] as const) {
      const r = await hit(ctx, body);
      if (r.ok) assert.fail(`expected ${JSON.stringify(body)} to be rejected`);
      assert.deepEqual([r.error.code, r.error.field], ['bad_request', field]);
    }
    const none = await hit(ctx, undefined);
    assert.equal(!none.ok && none.error.code, 'bad_request');
    assert.deepEqual(ctx.store.pagePoints, []);
  });

  it('keeps only a foreign referrer host', async () => {
    const ctx = setup();
    const refs = [
      'https://news.ycombinator.com/item?id=1',
      `https://${SITE_HOST}/install`, // internal navigation
      'not a url',
      '',
      'android-app://com.google.android.gm/',
      `https://${'h'.repeat(120)}.example/`,
    ];
    for (const ref of refs) await hit(ctx, { path: '/', ref });
    await hit(ctx, { path: '/' });
    assert.deepEqual(
      ctx.store.pagePoints.map((p) => p.refHost),
      ['news.ycombinator.com', null, null, null, 'com.google.android.gm', 'h'.repeat(LIMITS.hostLength), null],
    );
  });

  it('treats the same host on the dev server (with port) as internal', async () => {
    const ctx = fakeCtx({ store: createMemoryStore(), config: { allowedOrigins: ['http://127.0.0.1:8787'] } });
    await callHttp(
      hitOp,
      httpRequest({
        path: '/api/hit',
        body: { path: '/', ref: 'http://127.0.0.1:8787/faq' },
        headers: { origin: 'http://127.0.0.1:8787', host: '127.0.0.1:8787' },
      }),
      ctx,
    );
    assert.deepEqual(ctx.store.pagePoints.map((p) => p.refHost), [null]);
  });

  it('classifies the User-Agent', async () => {
    const ctx = setup();
    for (const ua of [UA.android, UA.ios, UA.desktop, UA.bot, UA.other, null]) await hit(ctx, { path: '/' }, { headers: { userAgent: ua } });
    assert.deepEqual(
      ctx.store.pagePoints.map((p) => p.uaClass),
      ['android', 'ios', 'desktop', 'bot', 'other', 'other'],
    );
  });

  it('degrades under the rate limit: 204 without writing a point', async () => {
    assert.equal(hitOp.whenLimited, 'degrade');
    const ctx = setup();
    assert.deepEqual(await hit(ctx, hitRequest(), { limited: true }), { ok: true, value: { status: 204 } });
    assert.deepEqual(ctx.store.pagePoints, []);
    assert.deepEqual(ctx.store.tables.site_daily, [], 'a limited caller is not counted in the rollup either');
    // Origin and shape rules still apply to a limited caller.
    const foreign = await hit(ctx, hitRequest(), { limited: true, headers: { origin: 'https://evil.example' } });
    assert.equal(!foreign.ok && foreign.error.code, 'forbidden');
    assert.deepEqual(ctx.log.entries, []);
  });

  it('still answers 204 when the point write fails, and logs a warning', async () => {
    const store = createMemoryStore();
    const ctx = setup({ ...store, writePagePoint: async () => err('unavailable', 'sink down') });
    assert.deepEqual(await hit(ctx, hitRequest()), { ok: true, value: { status: 204 } });
    assert.deepEqual(ctx.log.entries, [{ level: 'warn', message: 'page point not written', data: { code: 'unavailable', message: 'sink down' } }]);
  });

  it('still answers 204 when a buggy store throws, and logs an error', async () => {
    const store = createMemoryStore();
    const ctx = setup({
      ...store,
      writePagePoint: async () => {
        throw new Error('boom');
      },
    });
    assert.deepEqual(await hit(ctx, hitRequest()), { ok: true, value: { status: 204 } });
    assert.equal(ctx.log.entries[0]!.level, 'error');
  });
});
