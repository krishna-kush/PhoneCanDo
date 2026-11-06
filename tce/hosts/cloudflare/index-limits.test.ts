// The Worker's rate limiting over local D1 (worker.test-support.ts): each op
// asks its Workers Rate Limiting binding (fakes here) with "<op>:<client
// network>"; reject ops answer 429 before reading the body, degrade ops answer
// without counting, and a failing, missing or keyless limiter allows. The
// client address is only ever the key: never stored, never logged.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIMITS } from '../../core/schema/limits.ts';
import type { ErrorBody } from '../../core/schema/wire.ts';
import { batchRequest, forgetRequest, hitRequest, reportRequest, SITE_ORIGIN } from '../../testkit/fixtures.ts';
import type { Env } from './index.ts';
import { ADDRESS_NEEDLES, CLIENT_IP, CLIENT_IP6, fakeLimiter, stream, useWorker } from './worker.test-support.ts';

describe('Cloudflare host (index.ts): rate limits', () => {
  const w = useWorker();
  const { call, count, downloads, logs, pageviews, printed, rollup } = w;

  it('rate limits batch, report and forget per op and client address: 429 + Retry-After before any body read, nothing written', async () => {
    const ingest = fakeLimiter(() => false);
    const rare = fakeLimiter(() => false);
    const limited: Env = { ...w.env, RL_INGEST: ingest, RL_RARE: rare };
    const before = { devices: await count('devices'), events: await count('events'), reports: await count('reports') };
    const fresh = '22222222-3333-4444-8555-666666666666';
    for (const [path, body] of [
      ['/v1/batch', batchRequest({ batchId: fresh })],
      ['/v1/report', reportRequest({ reportId: fresh })],
      ['/v1/forget', forgetRequest()],
    ] as const) {
      const res = await call(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }, limited);
      assert.equal(res.status, 429, `${path}: ${await res.clone().text()}`);
      assert.equal(res.headers.get('retry-after'), '60');
      assert.equal(res.headers.get('cache-control'), 'no-store');
      assert.equal(((await res.json()) as ErrorBody).error.code, 'unavailable');
    }
    // Refused before the body is read: an oversized body is a 429, not a 413.
    const huge = await call('/v1/batch', { method: 'POST', body: stream(LIMITS.batchBodyBytes + 5000), headers: { 'content-type': 'application/json' } }, limited);
    assert.equal(huge.status, 429);
    assert.deepEqual(ingest.calls, [`batch:${CLIENT_IP}`, `batch:${CLIENT_IP}`]);
    assert.deepEqual(rare.calls, [`report:${CLIENT_IP}`, `forget:${CLIENT_IP}`]);
    assert.deepEqual({ devices: await count('devices'), events: await count('events'), reports: await count('reports') }, before);
  });

  it('keys IPv6 clients by their /64 network, and an allowed caller is served', async () => {
    const ingest = fakeLimiter(() => true);
    const res = await call(
      '/v1/batch',
      { method: 'POST', body: JSON.stringify(batchRequest({ batchId: '33333333-4444-4555-8666-777777777777' })), headers: { 'content-type': 'application/json' }, ip: CLIENT_IP6 },
      { ...w.env, RL_INGEST: ingest },
    );
    assert.equal(res.status, 200, await res.clone().text());
    assert.deepEqual(ingest.calls, ['batch:2001:db8:85a3:12::/64']);
  });

  it('degrades hit and download over the limit: same answer, no analytics point, no site_daily bump', async () => {
    const pub = fakeLimiter(() => false);
    const limited: Env = { ...w.env, RL_PUBLIC: pub };
    const points = { pageviews: pageviews.calls.length, downloads: downloads.calls.length };
    const site = await rollup();
    const hit = await call(
      '/v1/hit',
      { method: 'POST', body: JSON.stringify(hitRequest()), headers: { 'content-type': 'text/plain;charset=UTF-8', origin: SITE_ORIGIN } },
      limited,
    );
    assert.equal(hit.status, 204, await hit.clone().text());
    const dl = await call('/v1/dl/lite', {}, limited);
    assert.equal(dl.status, 302);
    assert.match(String(dl.headers.get('location')), /^https:\/\/github\.com\/.+lite.+\.apk$/);
    assert.deepEqual({ pageviews: pageviews.calls.length, downloads: downloads.calls.length }, points, 'nothing counted');
    assert.deepEqual(await rollup(), site, 'no rollup either');
    assert.deepEqual(pub.calls, [`hit:${CLIENT_IP}`, `download:${CLIENT_IP}`]);
    // Under the limit the same calls count again.
    const open: Env = { ...w.env, RL_PUBLIC: fakeLimiter(() => true) };
    assert.equal((await call('/v1/dl/lite', {}, open)).status, 302);
    assert.equal(downloads.calls.length, points.downloads + 1);
  });

  it('limits GET /v1/health on RL_PUBLIC: 429 + Retry-After over the limit, served under it', async () => {
    const pub = fakeLimiter(() => false);
    const refused = await call('/v1/health', {}, { ...w.env, RL_PUBLIC: pub });
    assert.equal(refused.status, 429, await refused.clone().text());
    assert.equal(refused.headers.get('retry-after'), '60');
    assert.deepEqual(pub.calls, [`health:${CLIENT_IP}`]);
    const open = fakeLimiter(() => true);
    const served = await call('/v1/health', {}, { ...w.env, RL_PUBLIC: open });
    assert.equal(served.status, 200);
    assert.deepEqual(open.calls, [`health:${CLIENT_IP}`]);
  });

  it('allows the request when the limiter throws, a binding is missing or there is no client address', async () => {
    const throwing: RateLimit = {
      limit: async ({ key }) => {
        throw new Error(`rate limit backend unreachable for ${key} (from ${CLIENT_IP})`);
      },
    };
    const res = await call('/v1/dl/full', {}, { ...w.env, RL_PUBLIC: throwing });
    assert.equal(res.status, 302);
    const failed = logs('rate limiter failed; request allowed');
    assert.equal(failed.length, 1);
    assert.equal(failed[0]?.['op'], 'download');
    assert.equal(failed[0]?.['binding'], 'RL_PUBLIC');
    assert.match(String(failed[0]?.['error']), /\[addr\]/);

    const pub = fakeLimiter(() => false);
    // No RL_INGEST binding: batch is not limited (and RL_PUBLIC is never asked for it).
    const batch = await call(
      '/v1/batch',
      { method: 'POST', body: JSON.stringify(batchRequest({ batchId: '44444444-5555-4666-8777-888888888888' })), headers: { 'content-type': 'application/json' } },
      { ...w.env, RL_PUBLIC: pub },
    );
    assert.equal(batch.status, 200, await batch.clone().text());
    // No cf-connecting-ip (not through Cloudflare's edge), or an empty one: nothing to key on, allowed.
    const noIp = await call('/v1/dl/lite', { ip: null }, { ...w.env, RL_PUBLIC: pub });
    assert.equal(noIp.status, 302);
    const emptyIp = await call('/v1/dl/lite', { ip: '' }, { ...w.env, RL_PUBLIC: pub });
    assert.equal(emptyIp.status, 302);
    assert.deepEqual(pub.calls, []);
  });

  it('stored no client address from the calls it let through', async () => {
    assert.ok((await count('devices')) > 0, 'the allowed batches wrote rows');
    for (const table of ['devices', 'installs', 'sessions', 'events', 'errors', 'reports', 'site_daily']) {
      const all = JSON.stringify((await w.env.DB.prepare(`SELECT * FROM ${table}`).all()).results);
      for (const needle of ADDRESS_NEEDLES) assert.ok(!all.includes(needle), `${table} contains ${needle}`);
    }
    const points = JSON.stringify([pageviews.calls, downloads.calls]);
    for (const needle of ADDRESS_NEEDLES) assert.ok(!points.includes(needle), `an analytics point contains ${needle}`);
  });

  it('logged structured JSON lines with a level, and no op threw', () => {
    assert.ok(printed.length > 0);
    for (const p of printed) {
      const entry = JSON.parse(p.line) as Record<string, unknown>;
      assert.ok(['info', 'warn', 'error'].includes(String(entry['level'])), p.line);
    }
    // Every request above carried cf-connecting-ip / x-forwarded-for; none of it reached a log line.
    for (const needle of ADDRESS_NEEDLES) {
      assert.deepEqual(
        printed.filter((p) => p.line.includes(needle)).map((p) => p.line),
        [],
        `${needle} was logged`,
      );
    }
    assert.deepEqual(logs('op threw'), []);
    assert.deepEqual(logs('cron op threw'), []);
  });
});
