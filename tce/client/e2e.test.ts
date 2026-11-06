// The SDK against the real server code: every request goes through the
// host's dispatch, the registry's ops and the memory store, so identity,
// verifier pinning, Delete my data and rate limiting are checked end to end.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import { dispatch, RATE_LIMIT_RETRY_AFTER_S } from '../core/http.ts';
import { httpOps } from '../core/ops/registry.ts';
import { HASH_PEPPER } from '../core/schema/limits.ts';
import { createMemoryStore, type MemoryStore } from '../stores/memory/index.ts';
import { fakeCtx } from '../testkit/ctx.ts';
import { FakeClock, FakeEnv, FakeIds, FakeLog, FakeStorage } from './fakes.ts';
import { BACKOFF_BASE_MS, createClient } from './index.ts';
import type { NetPort } from './types.ts';

const sha256 = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

// A phone's ids, made exactly as the app adapter makes them.
function phone(androidId: string): FakeEnv {
  const env = new FakeEnv();
  env.deviceId = sha256(HASH_PEPPER.device + androidId);
  env.deviceProof = sha256(HASH_PEPPER.forget + androidId);
  env.deviceVerifier = sha256(env.deviceProof);
  return env;
}

// A NetPort that runs each POST through the host dispatch over one store.
function server(store: MemoryStore, clock: FakeClock, limited: () => boolean = () => false): NetPort & { statuses: number[] } {
  const statuses: number[] = [];
  return {
    statuses,
    async post(url, body) {
      const bytes = new TextEncoder().encode(body);
      const res = await dispatch(
        {
          method: 'POST',
          path: new URL(url).pathname,
          query: {},
          headers: { userAgent: 'okhttp/4', referer: null, origin: null, host: 't.example', contentType: 'application/json' },
          contentLength: bytes.length,
          readBody: async (limit) => (bytes.length > limit ? { ok: false, reason: 'too_large' } : { ok: true, bytes }),
        },
        httpOps,
        fakeCtx({ store, now: clock.now() }),
        { limit: async () => !limited() },
      );
      statuses.push(res.status);
      return { status: res.status, text: res.body ?? '', retryAfter: res.headers['retry-after'] ?? null };
    },
  };
}

function app(store: MemoryStore, env: FakeEnv, opts: { storage?: FakeStorage; clock?: FakeClock; limited?: () => boolean } = {}) {
  const clock = opts.clock ?? new FakeClock();
  const net = server(store, clock, opts.limited);
  const storage = opts.storage ?? new FakeStorage();
  const client = createClient({ baseUrl: 'https://t.example', storage, net, env, clock, ids: new FakeIds(), log: new FakeLog() });
  return { client, net, clock, storage };
}

const rowsOf = (store: MemoryStore, deviceId: string): number =>
  store.tables.devices.filter((d) => d.device_id === deviceId).length +
  store.tables.installs.filter((i) => i.device_id === deviceId).length +
  store.tables.events.filter((e) => e.device_id === deviceId).length;

describe('client against the server', () => {
  it('Delete my data removes every install of the phone, and says not_found after', async () => {
    const store = createMemoryStore();
    const env = phone('9774d56d682e549c');
    const a = app(store, env);
    await a.client.init();
    a.client.startSession();
    a.client.track('chat.open');
    assert.ok((await a.client.flush())?.ok);
    // A second install id on the same phone (Reset anonymous ID).
    await a.client.resetInstallId();
    a.client.track('terminal.open');
    assert.ok((await a.client.flush())?.ok);
    assert.equal(store.tables.installs.filter((i) => i.device_id === env.deviceId).length, 2);
    assert.equal(store.tables.devices.find((d) => d.device_id === env.deviceId)?.verifier, env.deviceVerifier);

    const r = await a.client.forget();
    assert.ok(r.ok, JSON.stringify(r));
    assert.ok((r.value.deleted.installs ?? 0) >= 2);
    assert.equal(rowsOf(store, env.deviceId), 0);
    assert.equal(a.client.isEnabled(), false);

    // After a reinstall (fresh storage) nothing is left to delete.
    const b = app(store, env);
    await b.client.init();
    const again = await b.client.forget();
    assert.ok(!again.ok && again.error.code === 'not_found');
  });

  it('knowing a deviceId is not enough to write as, or delete, that phone', async () => {
    const store = createMemoryStore();
    const victim = phone('aaaa000011112222');
    const v = app(store, victim);
    await v.client.init();
    v.client.startSession();
    v.client.track('chat.open');
    assert.ok((await v.client.flush())?.ok);
    const before = rowsOf(store, victim.deviceId);

    const attacker = phone('bbbb000011112222');
    attacker.deviceId = victim.deviceId; // copied, but the proof is the attacker's own
    const x = app(store, attacker);
    await x.client.init();
    x.client.startSession();
    x.client.track('chat.open');
    const w = await x.client.flush();
    assert.ok(w && !w.ok && w.error.code === 'forbidden', JSON.stringify(w));
    const f = await x.client.forget();
    assert.ok(!f.ok && f.error.code === 'not_found');
    assert.equal(rowsOf(store, victim.deviceId), before);
  });

  it("waits out the server's Retry-After when rate limited", async () => {
    const store = createMemoryStore();
    let limited = true;
    const a = app(store, phone('cccc000011112222'), { limited: () => limited });
    await a.client.init();
    a.client.startSession();
    a.client.track('chat.open');
    const r = await a.client.flush();
    assert.ok(r && !r.ok && r.error.code === 'unavailable');
    assert.deepEqual(a.net.statuses, [429]);
    limited = false;
    const wait = RATE_LIMIT_RETRY_AFTER_S * 1000;
    assert.ok(wait > BACKOFF_BASE_MS, 'the test needs a Retry-After longer than the first backoff');
    a.clock.advance(BACKOFF_BASE_MS); // the client's own first backoff
    await a.client.flush();
    assert.deepEqual(a.net.statuses, [429]); // still inside Retry-After
    a.clock.advance(wait - BACKOFF_BASE_MS);
    assert.ok((await a.client.flush())?.ok);
    assert.deepEqual(a.net.statuses, [429, 200]);
  });
});
