import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { HEX64, UUID_V4 } from '../core/identity.ts';
import { HASH_PEPPER } from '../core/schema/limits.ts';
import { createMemoryStore } from '../stores/memory/index.ts';
import { DEFAULT_CONFIG, fakeCtx, webHash } from './ctx.ts';
import {
  ANDROID_ID,
  ANDROID_ID_2,
  DEVICE_PROOF,
  DEVICE_PROOF_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  STRANGER_PROOF,
  STRANGER_VERIFIER,
  T0,
} from './fixtures.ts';

describe('ownership fixtures', () => {
  it('derive exactly as core/schema/limits.ts HASH_PEPPER describes', async () => {
    assert.equal(await webHash.sha256Hex(HASH_PEPPER.forget + ANDROID_ID), DEVICE_PROOF);
    assert.equal(await webHash.sha256Hex(HASH_PEPPER.forget + ANDROID_ID_2), DEVICE_PROOF_2);
    assert.equal(await webHash.sha256Hex('stranger'), STRANGER_PROOF);
    assert.equal(await webHash.sha256Hex(DEVICE_PROOF), DEVICE_VERIFIER);
    assert.equal(await webHash.sha256Hex(DEVICE_PROOF_2), DEVICE_VERIFIER_2);
    assert.equal(await webHash.sha256Hex(STRANGER_PROOF), STRANGER_VERIFIER);
    for (const h of [DEVICE_PROOF, DEVICE_PROOF_2, STRANGER_PROOF, DEVICE_VERIFIER, DEVICE_VERIFIER_2, STRANGER_VERIFIER]) {
      assert.match(h, HEX64);
    }
  });
});

describe('fakeCtx', () => {
  it('starts at T0 with a settable clock', () => {
    const ctx = fakeCtx({ store: createMemoryStore() });
    assert.equal(ctx.clock.now(), T0);
    ctx.clock.set(5);
    ctx.clock.advance(10);
    assert.equal(ctx.clock.now(), 15);
    assert.equal(fakeCtx({ store: createMemoryStore(), now: 42 }).clock.now(), 42);
  });

  it('hands out sequential lowercase UUID v4s', () => {
    const ctx = fakeCtx({ store: createMemoryStore() });
    const a = ctx.ids.uuid();
    const b = ctx.ids.uuid();
    assert.equal(a, '00000000-0000-4000-8000-000000000001');
    assert.equal(b, '00000000-0000-4000-8000-000000000002');
    assert.ok(UUID_V4.test(a) && UUID_V4.test(b));
  });

  it('hashes with real SHA-256', async () => {
    const ctx = fakeCtx({ store: createMemoryStore() });
    assert.equal(await ctx.hash.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(await ctx.hash.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('routes fetches by the longest prefix, records calls, and fails on demand', async () => {
    const ctx = fakeCtx({ store: createMemoryStore() });
    ctx.fetch.route('https://x.test/a', 200, { which: 'short' });
    ctx.fetch.route('https://x.test/a?page=2', 201, { which: 'long' });
    ctx.fetch.routeText('https://x.test/html', 200, '<html>');
    ctx.fetch.fail('https://x.test/down');
    const short = await ctx.fetch('https://x.test/a?page=1');
    assert.deepEqual([short.status, short.ok, await short.json()], [200, true, { which: 'short' }]);
    const long = await ctx.fetch('https://x.test/a?page=2', { headers: { h: '1' } });
    assert.deepEqual([long.status, await long.json()], [201, { which: 'long' }]);
    const missing = await ctx.fetch('https://x.test/zzz');
    assert.deepEqual([missing.status, missing.ok], [404, false]);
    await assert.rejects((await ctx.fetch('https://x.test/html')).json(), SyntaxError);
    await assert.rejects(ctx.fetch('https://x.test/down'), TypeError);
    assert.deepEqual(ctx.fetch.calls[1], { url: 'https://x.test/a?page=2', init: { headers: { h: '1' } } });
    assert.equal(ctx.fetch.calls.length, 5);
  });

  it('collects log entries and merges config and edge overrides', () => {
    const ctx = fakeCtx({ store: createMemoryStore(), config: { githubToken: 't' }, edge: { country: null } });
    ctx.log.warn('w', { a: 1 });
    ctx.log.info('i');
    assert.deepEqual(ctx.log.entries, [
      { level: 'warn', message: 'w', data: { a: 1 } },
      { level: 'info', message: 'i' },
    ]);
    assert.deepEqual(ctx.config, { ...DEFAULT_CONFIG, githubToken: 't' });
    assert.equal(ctx.edge.country, null);
    assert.equal(ctx.edge.asn, 24560);
    assert.equal(fakeCtx({ store: createMemoryStore() }).edge.country, 'IN');
  });
});
