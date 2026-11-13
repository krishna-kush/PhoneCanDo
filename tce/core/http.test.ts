// Unit tests for the host-neutral dispatch in core/http.ts, driven through
// fake ops so every branch is reachable.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AnyHttpOp, CronOp, HttpRequest } from './op.ts';
import { err, ok } from './result.ts';
import { createMemoryStore } from '../stores/memory/index.ts';
import { fakeCtx } from '../testkit/ctx.ts';
import { SITE_HOST, SITE_ORIGIN, batchRequest, hitRequest } from '../testkit/fixtures.ts';
import { httpOps } from './ops/registry.ts';
import {
  RATE_LIMIT_RETRY_AFTER_S,
  buildConfig,
  dispatch,
  isOpPath,
  isSiteOpPath,
  jsonLogger,
  parseContentLength,
  parseOriginList,
  resolveRoute,
  runCron,
} from './http.ts';
import type { BodyRead, HostRequest } from './http.ts';

const encoder = new TextEncoder();

/** Records what the op saw; answers with whatever the test configured. */
function echoOp(over: Partial<AnyHttpOp> = {}): AnyHttpOp & { seen: HttpRequest[] } {
  const seen: HttpRequest[] = [];
  return {
    kind: 'http',
    name: 'echo',
    method: 'POST',
    path: '/v1/echo',
    maxBodyBytes: 32,
    parse: (req) => {
      seen.push(req);
      return ok(req.body);
    },
    run: async (input) => ok({ status: 200, json: { got: input } }),
    ...over,
    seen,
  };
}

function hostRequest(over: Partial<HostRequest> & { body?: string | Uint8Array } = {}): HostRequest & { reads: number[] } {
  const reads: number[] = [];
  const { body, ...rest } = over;
  const bytes = typeof body === 'string' ? encoder.encode(body) : (body ?? new Uint8Array(0));
  return {
    method: 'POST',
    path: '/v1/echo',
    query: {},
    headers: { userAgent: null, referer: null, origin: null, host: null, contentType: 'application/json', secFetchMode: null },
    contentLength: bytes.byteLength,
    readBody: async (limit): Promise<BodyRead> => {
      reads.push(limit);
      return bytes.byteLength > limit ? { ok: false, reason: 'too_large' } : { ok: true, bytes };
    },
    ...rest,
    reads,
  };
}

function ctx() {
  return fakeCtx({ store: createMemoryStore(), edge: { requestId: 'req-1' } });
}

function json(body: string | null): unknown {
  assert.notEqual(body, null);
  return JSON.parse(body as string);
}

describe('resolveRoute', () => {
  const get = echoOp({ name: 'dl', method: 'GET', path: '/v1/dl/:channel', maxBodyBytes: 0 });
  const post = echoOp();

  it('matches method and path and decodes params', () => {
    const m = resolveRoute([get, post], 'GET', '/v1/dl/li%74e');
    assert.equal(m.kind, 'op');
    if (m.kind === 'op') {
      assert.equal(m.op.name, 'dl');
      assert.deepEqual(m.params, { channel: 'lite' });
    }
  });

  it('serves HEAD from the GET route', () => {
    assert.equal(resolveRoute([get], 'HEAD', '/v1/dl/full').kind, 'op');
  });

  it('reports the allowed methods on a method mismatch', () => {
    assert.deepEqual(resolveRoute([get, post], 'POST', '/v1/dl/lite'), { kind: 'method_not_allowed', allow: ['GET', 'HEAD'] });
    assert.deepEqual(resolveRoute([get, post], 'GET', '/v1/echo'), { kind: 'method_not_allowed', allow: ['POST'] });
  });

  it('returns not_found for unknown paths', () => {
    assert.deepEqual(resolveRoute([get, post], 'GET', '/v1/nope'), { kind: 'not_found' });
    assert.deepEqual(resolveRoute([get, post], 'GET', '/v1/dl/lite/extra'), { kind: 'not_found' });
  });
});

describe('dispatch', () => {
  it('parses a JSON body and serializes the op response', async () => {
    const op = echoOp();
    const res = await dispatch(hostRequest({ body: '{"a":1}' }), [op], ctx());
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(res.headers['cache-control'], 'no-store');
    assert.deepEqual(json(res.body), { got: { a: 1 } });
    assert.deepEqual(op.seen[0]?.body, { a: 1 });
    assert.equal(op.seen[0]?.method, 'POST');
  });

  it('accepts text/plain (sendBeacon) and a missing content-type', async () => {
    for (const contentType of ['text/plain;charset=UTF-8', null]) {
      const req = hostRequest({ body: '{"b":2}' });
      req.headers.contentType = contentType;
      const res = await dispatch(req, [echoOp()], ctx());
      assert.equal(res.status, 200, String(contentType));
    }
  });

  it('rejects other content types with 400', async () => {
    const req = hostRequest({ body: 'a=1' });
    req.headers.contentType = 'application/x-www-form-urlencoded';
    const res = await dispatch(req, [echoOp()], ctx());
    assert.equal(res.status, 400);
    assert.deepEqual(json(res.body), {
      error: {
        code: 'bad_request',
        message: 'content-type must be application/json or text/plain',
        field: 'content-type',
        requestId: 'req-1',
      },
    });
  });

  it('rejects by Content-Length before reading the body', async () => {
    const req = hostRequest({ body: '{}', contentLength: 33 });
    const res = await dispatch(req, [echoOp()], ctx());
    assert.equal(res.status, 413);
    assert.equal((json(res.body) as { error: { code: string } }).error.code, 'too_large');
    assert.deepEqual(req.reads, []);
  });

  it('enforces the cap while reading when the header is absent or lies', async () => {
    const big = `{"x":"${'y'.repeat(40)}"}`;
    for (const contentLength of [null, 2]) {
      const req = hostRequest({ body: big, contentLength });
      const res = await dispatch(req, [echoOp()], ctx());
      assert.equal(res.status, 413);
      assert.deepEqual(req.reads, [32]);
    }
  });

  it('maps an aborted or failing body read to 400', async () => {
    const aborted = hostRequest({ readBody: async () => ({ ok: false, reason: 'aborted' }) });
    assert.equal((await dispatch(aborted, [echoOp()], ctx())).status, 400);
    const failing = hostRequest({
      readBody: async () => {
        throw new Error('socket hang up');
      },
    });
    assert.equal((await dispatch(failing, [echoOp()], ctx())).status, 400);
  });

  it('rejects invalid JSON and invalid UTF-8 with 400 bad_request', async () => {
    const badJson = await dispatch(hostRequest({ body: '{"a":' }), [echoOp()], ctx());
    assert.equal(badJson.status, 400);
    assert.equal((json(badJson.body) as { error: { message: string } }).error.message, 'body is not valid JSON');
    const badUtf8 = await dispatch(hostRequest({ body: new Uint8Array([0x22, 0xff, 0x22]) }), [echoOp()], ctx());
    assert.equal(badUtf8.status, 400);
    assert.equal((json(badUtf8.body) as { error: { message: string } }).error.message, 'body is not valid UTF-8');
  });

  it('passes an empty body to parse as undefined', async () => {
    const op = echoOp({ parse: (req) => (req.body === undefined ? err('bad_request', 'body required') : ok(req.body)) });
    const res = await dispatch(hostRequest(), [op], ctx());
    assert.equal(res.status, 400);
    assert.equal((json(res.body) as { error: { message: string } }).error.message, 'body required');
  });

  it('never reads a body for GET routes and passes params and query', async () => {
    const op = echoOp({ method: 'GET', path: '/v1/dl/:channel', maxBodyBytes: 0, run: async () => ok({ status: 302, location: 'https://example.com/a.apk' }) });
    const req = hostRequest({ method: 'GET', path: '/v1/dl/lite', query: { ref: 'x' }, contentLength: null });
    const res = await dispatch(req, [op], ctx());
    assert.equal(res.status, 302);
    assert.equal(res.headers['location'], 'https://example.com/a.apk');
    assert.equal(res.body, null);
    assert.deepEqual(req.reads, []);
    assert.deepEqual(op.seen[0]?.params, { channel: 'lite' });
    assert.deepEqual(op.seen[0]?.query, { ref: 'x' });
  });

  it('serves HEAD without a body and tells the op it was HEAD', async () => {
    const op = echoOp({ method: 'GET', path: '/v1/info', maxBodyBytes: 0, run: async () => ok({ status: 200, json: { a: 1 } }) });
    const res = await dispatch(hostRequest({ method: 'HEAD', path: '/v1/info' }), [op], ctx());
    assert.equal(res.status, 200);
    assert.equal(res.body, null);
    assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
    assert.equal(op.seen[0]?.method, 'HEAD');
  });

  it('drops the body of a 204 and lets op headers override defaults', async () => {
    const op = echoOp({ run: async () => ok({ status: 204, json: { ignored: true }, headers: { 'Cache-Control': 'max-age=60', 'X-Extra': '1' } }) });
    const res = await dispatch(hostRequest({ body: '{}' }), [op], ctx());
    assert.equal(res.status, 204);
    assert.equal(res.body, null);
    assert.equal(res.headers['cache-control'], 'max-age=60');
    assert.equal(res.headers['x-extra'], '1');
    assert.equal(res.headers['content-type'], undefined);
  });

  it('maps parse and run errors through HTTP_STATUS with the request id', async () => {
    const cases = [
      ['forbidden', 403],
      ['not_found', 404],
      ['too_large', 413],
      ['unsupported', 400],
      ['unavailable', 503],
      ['internal', 500],
    ] as const;
    for (const [code, status] of cases) {
      const c = ctx();
      const op = echoOp({ run: async () => err(code, `nope ${code}`, 'events.0') });
      const res = await dispatch(hostRequest({ body: '{}' }), [op], c);
      assert.equal(res.status, status, code);
      assert.deepEqual(json(res.body), { error: { code, message: `nope ${code}`, field: 'events.0', requestId: 'req-1' } });
      const warned = c.log.entries.some((e) => e.level === 'warn' && e.message === 'op failed');
      assert.equal(warned, code === 'unavailable' || code === 'internal', code);
    }
  });

  it('turns a throw into 500 internal and logs it', async () => {
    for (const where of ['parse', 'run'] as const) {
      const c = ctx();
      const boom = (): never => {
        throw new TypeError(`boom in ${where}`);
      };
      const op = where === 'parse' ? echoOp({ parse: boom }) : echoOp({ run: async () => boom() });
      const res = await dispatch(hostRequest({ body: '{}' }), [op], c);
      assert.equal(res.status, 500);
      assert.deepEqual(json(res.body), { error: { code: 'internal', message: 'internal error', requestId: 'req-1' } });
      const logged = c.log.entries.find((e) => e.level === 'error');
      assert.equal(logged?.message, 'op threw');
      assert.equal(logged?.data?.['op'], 'echo');
      assert.equal(logged?.data?.['error'], `boom in ${where}`);
    }
  });

  it('answers 404 and 405 (with Allow) as JSON errors', async () => {
    const notFound = await dispatch(hostRequest({ path: '/v1/missing' }), [echoOp()], ctx());
    assert.equal(notFound.status, 404);
    assert.equal((json(notFound.body) as { error: { code: string } }).error.code, 'not_found');
    const wrong = await dispatch(hostRequest({ method: 'GET' }), [echoOp()], ctx());
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers['allow'], 'POST');
    assert.equal((json(wrong.body) as { error: { requestId: string } }).error.requestId, 'req-1');
  });

  it('omits requestId when the host has none', async () => {
    const c = fakeCtx({ store: createMemoryStore(), edge: { requestId: null } });
    const res = await dispatch(hostRequest({ path: '/v1/missing' }), [echoOp()], c);
    assert.deepEqual(json(res.body), { error: { code: 'not_found', message: 'no route for /v1/missing' } });
  });
});

describe('dispatch rate limiting', () => {
  const refuse = async (): Promise<boolean> => false;

  it('answers 429 with Retry-After before reading the body for a reject op', async () => {
    for (const whenLimited of [undefined, 'reject'] as const) {
      const op = echoOp(whenLimited ? { whenLimited } : {});
      const req = hostRequest({ body: '{"a":1}' });
      const c = ctx();
      const res = await dispatch(req, [op], c, { limit: refuse });
      assert.equal(res.status, 429, String(whenLimited));
      assert.equal(res.headers['retry-after'], '60');
      assert.equal(RATE_LIMIT_RETRY_AFTER_S, 60);
      assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
      assert.equal(res.headers['cache-control'], 'no-store');
      assert.deepEqual(json(res.body), { error: { code: 'unavailable', message: 'rate limited', requestId: 'req-1' } });
      assert.deepEqual(req.reads, [], 'the body is never read');
      assert.deepEqual(op.seen, [], 'parse never runs');
    }
  });

  it('answers a limited HEAD with 429 and no body', async () => {
    const op = echoOp({ method: 'GET', path: '/v1/info', maxBodyBytes: 0 });
    const res = await dispatch(hostRequest({ method: 'HEAD', path: '/v1/info' }), [op], ctx(), { limit: refuse });
    assert.equal(res.status, 429);
    assert.equal(res.body, null);
    assert.equal(res.headers['retry-after'], '60');
  });

  it('runs a degrade op with req.limited = true; an allowed or unlimited request has limited = false', async () => {
    const op = echoOp({ whenLimited: 'degrade' });
    const limited = await dispatch(hostRequest({ body: '{"a":1}' }), [op], ctx(), { limit: refuse });
    assert.equal(limited.status, 200);
    assert.deepEqual(json(limited.body), { got: { a: 1 } });
    await dispatch(hostRequest({ body: '{}' }), [op], ctx(), { limit: async () => true });
    await dispatch(hostRequest({ body: '{}' }), [op], ctx());
    assert.deepEqual(
      op.seen.map((r) => r.limited),
      [true, false, false],
    );
  });

  it('asks the limiter once per routed request, with the op, and never for unknown routes or methods', async () => {
    const asked: string[] = [];
    const limit = async (op: AnyHttpOp): Promise<boolean> => {
      asked.push(op.name);
      return true;
    };
    const op = echoOp();
    await dispatch(hostRequest({ body: '{}' }), [op], ctx(), { limit });
    await dispatch(hostRequest({ path: '/v1/missing' }), [op], ctx(), { limit });
    await dispatch(hostRequest({ method: 'GET' }), [op], ctx(), { limit });
    assert.deepEqual(asked, ['echo']);
  });

  it('allows the request and logs a warning when the limiter throws or rejects', async () => {
    // The message may carry the limiter key (a client address); only the error type is logged.
    for (const limit of [
      async (): Promise<boolean> => {
        throw new Error('limiter down for batch:203.0.113.7');
      },
      (): Promise<boolean> => Promise.reject(new Error('limiter down for batch:203.0.113.7')),
    ]) {
      const c = ctx();
      const op = echoOp();
      const res = await dispatch(hostRequest({ body: '{"a":1}' }), [op], c, { limit });
      assert.equal(res.status, 200);
      assert.equal(op.seen[0]?.limited, false);
      const warned = c.log.entries.find((e) => e.level === 'warn');
      assert.equal(warned?.message, 'rate limiter threw; request allowed');
      assert.equal(warned?.data?.['op'], 'echo');
      assert.equal(warned?.data?.['error'], 'Error');
      assert.ok(!JSON.stringify(c.log.entries).includes('203.0.113.7'));
    }
  });

  it('over the real registry: batch answers 429, hit answers 204 and download 302 without writing a point (reviewer scenario)', async () => {
    const store = createMemoryStore();
    const c = fakeCtx({ store, edge: { requestId: 'req-1' } });

    const batch = await dispatch(hostRequest({ path: '/v1/batch', body: JSON.stringify(batchRequest()) }), httpOps, c, { limit: refuse });
    assert.equal(batch.status, 429);
    assert.equal(batch.headers['retry-after'], '60');
    assert.equal(store.tables.devices.length, 0);

    const hitReq = hostRequest({ path: '/v1/hit', body: JSON.stringify(hitRequest()) });
    hitReq.headers.origin = SITE_ORIGIN;
    hitReq.headers.host = SITE_HOST;
    const hit = await dispatch(hitReq, httpOps, c, { limit: refuse });
    assert.equal(hit.status, 204);
    assert.equal(hit.body, null);

    const dl = await dispatch(hostRequest({ method: 'GET', path: '/v1/dl/lite', contentLength: null }), httpOps, c, { limit: refuse });
    assert.equal(dl.status, 302);
    assert.match(dl.headers['location'] ?? '', /\/releases\/download\/v0\.1\.2\/phonecando-0\.1\.2-lite-arm64\.apk$/);

    assert.deepEqual(store.pagePoints, []);
    assert.deepEqual(store.downloadPoints, []);

    // The same requests unlimited do write their points.
    await dispatch(hitReq, httpOps, c, { limit: async () => true });
    await dispatch(hostRequest({ method: 'GET', path: '/v1/dl/lite', contentLength: null }), httpOps, c);
    assert.equal(store.pagePoints.length, 1);
    assert.equal(store.downloadPoints.length, 1);
  });
});

describe('runCron', () => {
  const cron = (name: string, schedule: string, run: CronOp['run']): CronOp => ({ kind: 'cron', name, schedule, run });

  it('runs only the ops due for the schedule and summarizes each', async () => {
    const c = ctx();
    const ran: string[] = [];
    const ops = [
      cron('a', '7 * * * *', async () => {
        ran.push('a');
        c.clock.advance(5);
        return ok({ moved: 3 });
      }),
      cron('b', '17 3 * * *', async () => {
        ran.push('b');
        return ok({});
      }),
      cron('c', '7 * * * *', async () => err('unavailable', 'database busy')),
      cron('d', '7 * * * *', async () => {
        throw new Error('bug');
      }),
    ];
    const summaries = await runCron(ops, '7 * * * *', c);
    assert.deepEqual(ran, ['a']);
    assert.deepEqual(summaries, [
      { op: 'a', ok: true, ms: 5, result: { moved: 3 } },
      { op: 'c', ok: false, ms: 0, error: { code: 'unavailable', message: 'database busy' } },
      { op: 'd', ok: false, ms: 0, error: { code: 'internal', message: 'cron op threw' } },
    ]);
    assert.ok(c.log.entries.some((e) => e.message === 'cron op done' && e.data?.['op'] === 'a'));
    assert.ok(c.log.entries.some((e) => e.message === 'cron op failed' && e.data?.['op'] === 'c'));
    assert.ok(c.log.entries.some((e) => e.message === 'cron op threw' && e.data?.['error'] === 'bug'));
  });

  it('warns when no op is due', async () => {
    const c = ctx();
    assert.deepEqual(await runCron([], '1 2 3 4 5', c), []);
    assert.equal(c.log.entries[0]?.message, 'no cron op for schedule');
  });
});

describe('helpers', () => {
  it('isOpPath covers /v1/* and the share links /i/*', () => {
    assert.ok(isOpPath('/v1/batch'));
    assert.ok(isOpPath('/v1/dl/lite'));
    assert.ok(isOpPath('/i/k7q2m9xa'));
    assert.ok(!isOpPath('/'));
    assert.ok(!isOpPath('/v1'));
    assert.ok(!isOpPath('/i'));
    assert.ok(!isOpPath('/install'));
    assert.ok(!isOpPath('/apix/batch'));
    assert.ok(!isOpPath('/download'));
  });

  it('isSiteOpPath covers the share links /i/* only', () => {
    assert.ok(isSiteOpPath('/i/k7q2m9xa'));
    assert.ok(isSiteOpPath('/i/:code'));
    assert.ok(!isSiteOpPath('/v1/batch'));
    assert.ok(!isSiteOpPath('/v1/share/stats'));
    assert.ok(!isSiteOpPath('/install'));
  });

  it('parses origin lists and content lengths', () => {
    assert.deepEqual(parseOriginList(' https://a.example , ,https://b.example,https://a.example'), ['https://a.example', 'https://b.example']);
    assert.deepEqual(parseOriginList(undefined), []);
    assert.equal(parseContentLength('120'), 120);
    assert.equal(parseContentLength(null), null);
    assert.equal(parseContentLength('-1'), null);
    assert.equal(parseContentLength('1e3'), null);
  });

  it('buildConfig maps release facts, token, origins and the retention switch (off unless "true")', () => {
    assert.deepEqual(
      buildConfig({ appVersion: '0.1.2', repo: 'o/r', githubToken: '', allowedOrigins: undefined, defaultOrigins: ['http://127.0.0.1:8787'] }),
      { release: { repo: 'o/r', version: '0.1.2' }, githubToken: null, allowedOrigins: ['http://127.0.0.1:8787'], retentionEnabled: false },
    );
    assert.deepEqual(
      buildConfig({
        appVersion: '1',
        repo: 'o/r',
        githubToken: 'tok',
        allowedOrigins: 'https://x, https://y',
        defaultOrigins: ['http://z'],
        retentionEnabled: ' TRUE ',
      }),
      { release: { repo: 'o/r', version: '1' }, githubToken: 'tok', allowedOrigins: ['https://x', 'https://y'], retentionEnabled: true },
    );
    assert.deepEqual(buildConfig({ appVersion: '1', repo: 'o/r', githubToken: null, allowedOrigins: null }).allowedOrigins, []);
    for (const raw of ['false', '1', 'yes', '', null, undefined]) {
      assert.equal(buildConfig({ appVersion: '1', repo: 'o/r', githubToken: null, allowedOrigins: null, retentionEnabled: raw }).retentionEnabled, false, String(raw));
    }
  });

  it('jsonLogger writes one JSON object per line with level, base fields and errors', () => {
    const lines: Array<[string, string]> = [];
    const log = jsonLogger(
      { log: (l) => lines.push(['log', l]), warn: (l) => lines.push(['warn', l]), error: (l) => lines.push(['error', l]) },
      { requestId: 'r' },
      { now: () => 0 },
    );
    log.info('hello', { n: 1 });
    log.error('bad', { cause: new RangeError('out'), big: 10n });
    assert.equal(lines[0]?.[0], 'log');
    assert.deepEqual(JSON.parse(lines[0]![1]), { level: 'info', message: 'hello', requestId: 'r', n: 1, time: '1970-01-01T00:00:00.000Z' });
    const second = JSON.parse(lines[1]![1]) as Record<string, unknown>;
    assert.equal(lines[1]?.[0], 'error');
    assert.equal(second['big'], '10');
    assert.equal((second['cause'] as Record<string, string>)['error'], 'out');
  });
});
