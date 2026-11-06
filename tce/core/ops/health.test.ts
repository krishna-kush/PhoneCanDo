import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore } from '../../stores/memory/index.ts';
import { DEFAULT_CONFIG, callHttp, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import { T0, deviceRow, eventRow, httpRequest, installRow, sessionRow } from '../../testkit/fixtures.ts';
import { dispatch, type HostRequest } from '../http.ts';
import { err, ok } from '../result.ts';
import { CAPACITY, RETENTION_DAYS } from '../schema/limits.ts';
import type { HealthResponse } from '../schema/wire.ts';
import type { Store, StoreUsage } from '../store.ts';
import { DAY_MS } from '../time.ts';
import { healthBody, healthOp } from './health.ts';
import { httpOps } from './registry.ts';

function get(ctx: FakeCtx) {
  return callHttp(healthOp, httpRequest({ method: 'GET', path: '/v1/health' }), ctx);
}

/** A bodiless GET as a host hands it to dispatch. */
function hostGet(method = 'GET'): HostRequest {
  return {
    method,
    path: '/v1/health',
    query: {},
    headers: { userAgent: 'check-limits', referer: null, origin: null, host: 'phonecando.app', contentType: null },
    contentLength: null,
    readBody: async () => {
      throw new Error('a GET body must never be read');
    },
  };
}

const RATIOS = { limitBytes: CAPACITY.dbLimitBytes, warnRatio: CAPACITY.warnRatio, guardRatio: CAPACITY.guardRatio };
const DAYS = { events: RETENTION_DAYS.events, errors: RETENTION_DAYS.errors, reports: RETENTION_DAYS.reports };
const NO_OLDEST = { events: null, errors: null, reports: null };

/** A usage value with nothing kept. */
function usage(over: Partial<StoreUsage> = {}): StoreUsage {
  return { dbBytes: null, ingestPaused: false, oldestReceived: NO_OLDEST, ...over };
}

/** The retention block for an empty database. */
function retention(enabled: boolean): HealthResponse['retention'] {
  return { enabled, days: DAYS, oldestDays: NO_OLDEST };
}

describe('health', () => {
  it('is a public bodiless GET with the default whenLimited (reject)', () => {
    assert.deepEqual([healthOp.kind, healthOp.name, healthOp.method, healthOp.path, healthOp.maxBodyBytes], ['http', 'health', 'GET', '/v1/health', 0]);
    assert.equal(healthOp.whenLimited, undefined);
    assert.deepEqual(RATIOS, { limitBytes: 500_000_000, warnRatio: 0.7, guardRatio: 0.9 });
  });

  it('reports the store usage next to the free-plan limit and ratios, never cached', async () => {
    const store: Store = { ...createMemoryStore(), usage: async () => ok(usage({ dbBytes: 123_456_789, ingestPaused: true })) };
    const ctx = fakeCtx({ store, now: T0 + 5 });
    const body: HealthResponse = {
      serverTime: T0 + 5,
      db: { bytes: 123_456_789, ...RATIOS },
      ingestPaused: true,
      retention: retention(true),
    };
    assert.deepEqual(await get(ctx), { ok: true, value: { status: 200, json: body, headers: { 'Cache-Control': 'no-store' } } });
    assert.deepEqual(ctx.log.entries, []);
  });

  it('reports the retention switch from config and the age of the oldest kept row in whole days', async () => {
    const now = T0 + 100 * DAY_MS;
    const store: Store = {
      ...createMemoryStore(),
      // events 85.9 days old, errors exactly 10 days, reports none.
      usage: async () => ok(usage({ oldestReceived: { events: now - 85.9 * DAY_MS, errors: now - 10 * DAY_MS, reports: null } })),
    };
    const ctx = fakeCtx({ store, now, config: { ...DEFAULT_CONFIG, retentionEnabled: false } });
    const r = await get(ctx);
    const body = (r.ok ? r.value.json : null) as HealthResponse;
    assert.deepEqual(body.retention, { enabled: false, days: DAYS, oldestDays: { events: 85, errors: 10, reports: null } });
  });

  it('reads the oldest kept row from a real store (memory)', async () => {
    const store = createMemoryStore();
    const now = T0 + 40 * DAY_MS;
    const applied = await store.applyBatch({
      device: deviceRow(),
      install: installRow(),
      sessions: [sessionRow()],
      events: [eventRow({ received: T0 })],
      errors: [],
    });
    assert.equal(applied.ok, true);
    const r = await get(fakeCtx({ store, now }));
    const body = (r.ok ? r.value.json : null) as HealthResponse;
    assert.deepEqual(body.retention.oldestDays, { events: 40, errors: null, reports: null });
  });

  it('passes through a store that cannot tell its size (memory: bytes null)', async () => {
    const ctx = fakeCtx({ store: createMemoryStore() });
    const r = await get(ctx);
    assert.deepEqual(r.ok && r.value.json, { serverTime: T0, db: { bytes: null, ...RATIOS }, ingestPaused: false, retention: retention(true) });
  });

  it('answers 200 with unknowns and ingest not paused when usage fails, and logs a warning', async () => {
    const ctx = fakeCtx({ store: { ...createMemoryStore(), usage: async () => err('unavailable', 'db busy') } });
    const r = await get(ctx);
    assert.deepEqual(r, {
      ok: true,
      value: { status: 200, json: healthBody(T0, usage(), true), headers: { 'Cache-Control': 'no-store' } },
    });
    assert.deepEqual(ctx.log.entries, [{ level: 'warn', message: 'health: store usage unavailable', data: { code: 'unavailable', message: 'db busy' } }]);
  });

  it('answers 200 with unknowns when a buggy store throws, and logs an error', async () => {
    const store: Store = {
      ...createMemoryStore(),
      usage: async () => {
        throw new Error('boom');
      },
    };
    const ctx = fakeCtx({ store });
    const r = await get(ctx);
    assert.deepEqual(r.ok && [r.value.status, r.value.json], [200, healthBody(T0, usage(), true)]);
    assert.deepEqual(ctx.log.entries, [{ level: 'error', message: 'health: store usage threw', data: { error: 'boom' } }]);
  });

  it('through dispatch over the real registry: JSON 200, HEAD without a body, other methods 405, 429 when limited', async () => {
    const ctx = fakeCtx({ store: { ...createMemoryStore(), usage: async () => ok(usage({ dbBytes: 4096 })) } });
    const res = await dispatch(hostGet(), httpOps, ctx);
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.deepEqual(JSON.parse(res.body ?? ''), { serverTime: T0, db: { bytes: 4096, ...RATIOS }, ingestPaused: false, retention: retention(true) });

    const head = await dispatch(hostGet('HEAD'), httpOps, ctx);
    assert.deepEqual([head.status, head.body], [200, null]);

    const post = await dispatch(hostGet('POST'), httpOps, ctx);
    assert.deepEqual([post.status, post.headers['allow']], [405, 'GET, HEAD']);

    const limited = await dispatch(hostGet(), httpOps, ctx, { limit: async () => false });
    assert.deepEqual([limited.status, limited.headers['retry-after']], [429, '60']);
  });
});
