// End-to-end: the node host on an ephemeral port over a ':memory:' sqlite
// store, driven with real HTTP. Tests run in order and share the server.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { IncomingHttpHeaders, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { LIMITS } from '../../core/schema/limits.ts';
import { CAPACITY } from '../../core/schema/limits.ts';
import type { BatchResponse, ErrorBody, ForgetResponse, HealthResponse, ReportResponse } from '../../core/schema/wire.ts';
import type { Store } from '../../core/store.ts';
import { createSqliteStore } from '../../stores/sqlite/index.ts';
import { collectingLogger, DEFAULT_CONFIG, fakeClock, sequentialIds } from '../../testkit/ctx.ts';
import { batchRequest, forgetRequest, hitRequest, reportRequest, SITE_ORIGIN, T0, UA } from '../../testkit/fixtures.ts';
import { createNodeServer } from './server.ts';

interface Reply {
  status: number;
  headers: IncomingHttpHeaders;
  text: string;
}

interface CallOptions {
  body?: string | Uint8Array;
  headers?: Record<string, string>;
  /** Send the body as two chunks without Content-Length (Transfer-Encoding: chunked). */
  chunked?: boolean;
}

function call(port: number, method: string, path: string, opts: CallOptions = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const body = typeof opts.body === 'string' ? Buffer.from(opts.body) : opts.body ? Buffer.from(opts.body) : null;
    const headers: Record<string, string> = { 'user-agent': UA.android, ...opts.headers };
    if (body && !opts.chunked) headers['content-length'] = String(body.byteLength);
    const req = httpRequest({ host: '127.0.0.1', port, method, path, headers, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    req.on('error', reject);
    if (body && opts.chunked) {
      const mid = Math.floor(body.byteLength / 2);
      req.write(body.subarray(0, mid));
      req.write(body.subarray(mid));
    } else if (body) {
      req.write(body);
    }
    req.end();
  });
}

const postJson = (port: number, path: string, value: unknown, headers: Record<string, string> = {}) =>
  call(port, 'POST', path, { body: JSON.stringify(value), headers: { 'content-type': 'application/json', ...headers } });

function errorOf(reply: Reply): ErrorBody['error'] {
  return (JSON.parse(reply.text) as ErrorBody).error;
}

describe('node host over sqlite :memory:', () => {
  let server: Server;
  let port: number;
  let store: Store;
  let close: () => Promise<void>;
  const log = collectingLogger();

  before(async () => {
    const sqlite = createSqliteStore(':memory:', { log, clock: { now: () => T0 } });
    store = sqlite.store;
    close = sqlite.close;
    server = createNodeServer({ store: sqlite.store, config: DEFAULT_CONFIG, log, clock: fakeClock(T0), ids: sequentialIds() });
    await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
    port = (server.address() as AddressInfo).port;
  });

  after(async () => {
    await new Promise<void>((done) => server.close(() => done()));
    await close();
  });

  it('accepts a batch and stores its rows', async () => {
    const reply = await postJson(port, '/v1/batch', batchRequest());
    assert.equal(reply.status, 200, reply.text);
    assert.match(String(reply.headers['content-type']), /^application\/json/);
    assert.equal(reply.headers['cache-control'], 'no-store');
    const body = JSON.parse(reply.text) as BatchResponse;
    assert.equal(body.accepted.events, 2);
    assert.equal(body.accepted.errors, 1);
    assert.equal(body.accepted.sessions, 1);
    assert.equal(body.droppedEvents, 0);
  });

  it('treats a replayed batch as nothing new', async () => {
    const reply = await postJson(port, '/v1/batch', batchRequest());
    assert.equal(reply.status, 200, reply.text);
    const body = JSON.parse(reply.text) as BatchResponse;
    assert.equal(body.accepted.events, 0);
    assert.equal(body.accepted.errors, 0);
  });

  it('records a page hit from an allowed Origin (204) and refuses one without (403)', async () => {
    const allowed = await call(port, 'POST', '/v1/hit', {
      body: JSON.stringify(hitRequest()),
      headers: { 'content-type': 'text/plain;charset=UTF-8', origin: SITE_ORIGIN },
    });
    assert.equal(allowed.status, 204, allowed.text);
    assert.equal(allowed.text, '');
    const missing = await call(port, 'POST', '/v1/hit', {
      body: JSON.stringify(hitRequest()),
      headers: { 'content-type': 'text/plain;charset=UTF-8' },
    });
    assert.equal(missing.status, 403, missing.text);
    assert.equal(errorOf(missing).code, 'forbidden');
    const foreign = await call(port, 'POST', '/v1/hit', {
      body: JSON.stringify(hitRequest()),
      headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    });
    assert.equal(foreign.status, 403, foreign.text);
    // Only the allowed hit counted, on the clock's UTC day.
    assert.deepEqual(await store.listSiteDaily('2000-01-01', '2999-12-31'), {
      ok: true,
      value: [{ day: new Date(T0).toISOString().slice(0, 10), kind: 'view', key: '/install', country: '', count: 1 }],
    });
  });

  it('redirects /v1/dl/lite to the GitHub asset of the current release (GET and HEAD)', async () => {
    for (const method of ['GET', 'HEAD']) {
      const reply = await call(port, method, '/v1/dl/lite');
      assert.equal(reply.status, 302, `${method}: ${reply.text}`);
      const location = String(reply.headers.location);
      assert.ok(
        location.startsWith(`https://github.com/${DEFAULT_CONFIG.release.repo}/releases/download/`),
        `${method} location ${location}`,
      );
      assert.ok(location.includes(DEFAULT_CONFIG.release.version), location);
      assert.equal(reply.text, '');
    }
    const unknown = await call(port, 'GET', '/v1/dl/beta');
    assert.equal(unknown.status, 404, unknown.text);
    const site = await store.listSiteDaily('2000-01-01', '2999-12-31');
    assert.ok(site.ok);
    assert.deepEqual(
      site.value.filter((r) => r.kind === 'download').map((r) => [r.key, r.country, r.count]),
      [['lite', '', 1]],
      'GET counted, HEAD not (no edge here: country unknown)',
    );
  });

  it('answers GET /v1/health with the sqlite file size and no paused ingest', async () => {
    const reply = await call(port, 'GET', '/v1/health');
    assert.equal(reply.status, 200, reply.text);
    assert.equal(reply.headers['cache-control'], 'no-store');
    const body = JSON.parse(reply.text) as HealthResponse;
    const usage = await store.usage();
    assert.ok(usage.ok);
    const { retention, ...rest } = body;
    assert.deepEqual(rest, {
      serverTime: T0,
      db: { bytes: usage.value.dbBytes, limitBytes: CAPACITY.dbLimitBytes, warnRatio: CAPACITY.warnRatio, guardRatio: CAPACITY.guardRatio },
      ingestPaused: false,
    });
    assert.equal(typeof retention.enabled, 'boolean');
    assert.deepEqual(retention.days, { events: 90, errors: 180, reports: 90 });
    assert.deepEqual(Object.keys(retention.oldestDays).sort(), ['errors', 'events', 'reports']);
    assert.equal(typeof body.db.bytes, 'number');
    assert.ok(body.db.bytes! > 0);
  });

  it('stores a report', async () => {
    const reply = await postJson(port, '/v1/report', reportRequest());
    assert.equal(reply.status, 200, reply.text);
    assert.equal((JSON.parse(reply.text) as ReportResponse).reportId, reportRequest().reportId);
  });

  it('forgets every row of the device, then reports not_found', async () => {
    const reply = await postJson(port, '/v1/forget', forgetRequest());
    assert.equal(reply.status, 200, reply.text);
    const { deleted } = JSON.parse(reply.text) as ForgetResponse;
    assert.deepEqual(
      { devices: deleted['devices'], installs: deleted['installs'], sessions: deleted['sessions'], events: deleted['events'], errors: deleted['errors'], reports: deleted['reports'] },
      { devices: 1, installs: 1, sessions: 1, events: 2, errors: 1, reports: 1 },
    );
    const again = await postJson(port, '/v1/forget', forgetRequest());
    assert.equal(again.status, 404, again.text);
    assert.equal(errorOf(again).code, 'not_found');
  });

  it('rejects a body over the cap by Content-Length (413)', async () => {
    const reply = await call(port, 'POST', '/v1/batch', {
      body: new Uint8Array(LIMITS.batchBodyBytes + 1).fill(0x20),
      headers: { 'content-type': 'application/json' },
    });
    assert.equal(reply.status, 413, reply.text);
    assert.equal(errorOf(reply).message, `body is ${LIMITS.batchBodyBytes + 1} bytes; the limit is ${LIMITS.batchBodyBytes}`);
  });

  it('rejects a body over the cap while streaming when there is no Content-Length (413)', async () => {
    const reply = await call(port, 'POST', '/v1/batch', {
      body: new Uint8Array(LIMITS.batchBodyBytes + 1000).fill(0x20),
      headers: { 'content-type': 'application/json' },
      chunked: true,
    });
    assert.equal(reply.status, 413, reply.text);
    assert.equal(errorOf(reply).message, `body is over the ${LIMITS.batchBodyBytes}-byte limit`);
  });

  it('keeps serving after a 413 (the socket survives the drain)', async () => {
    const reply = await call(port, 'GET', '/v1/dl/full');
    assert.equal(reply.status, 302);
  });

  it('rejects invalid JSON with 400 bad_request and a request id', async () => {
    const reply = await call(port, 'POST', '/v1/batch', { body: '{"schema":', headers: { 'content-type': 'application/json' } });
    assert.equal(reply.status, 400, reply.text);
    const error = errorOf(reply);
    assert.equal(error.code, 'bad_request');
    assert.equal(error.message, 'body is not valid JSON');
    assert.match(String(error.requestId), /^[0-9a-f-]{36}$/);
  });

  it('answers unknown paths with 404 and a wrong method with 405 + Allow', async () => {
    for (const path of ['/v1/nope', '/', '/index.html']) {
      const reply = await call(port, 'GET', path);
      assert.equal(reply.status, 404, path);
      assert.equal(errorOf(reply).code, 'not_found');
    }
    const wrong = await call(port, 'GET', '/v1/batch');
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.allow, 'POST');
    const wrongDl = await call(port, 'POST', '/v1/dl/lite', { body: '{}', headers: { 'content-type': 'application/json' } });
    assert.equal(wrongDl.status, 405);
    assert.equal(wrongDl.headers.allow, 'GET, HEAD');
  });

  it('logged one line per request and no op failures', () => {
    assert.ok(log.entries.some((e) => e.message === 'request' && e.data?.['path'] === '/v1/batch' && e.data?.['status'] === 200));
    assert.deepEqual(
      log.entries.filter((e) => e.level === 'error'),
      [],
    );
  });
});

describe('node host main.ts', () => {
  it('starts on PORT=0 with TCE_DB, serves, and shuts down cleanly on SIGTERM', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'tce-main-'));
    let running: ChildProcess | undefined;
    try {
      const dbPath = join(dir, 'nested', 'tce.sqlite');
      const env: NodeJS.ProcessEnv = { ...process.env, PORT: '0', TCE_DB: dbPath };
      const child = spawn(process.execPath, [fileURLToPath(new URL('./main.ts', import.meta.url))], {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      running = child;
      const exited = new Promise<number | null>((done) => child.on('exit', (code) => done(code)));
      const lines: Record<string, unknown>[] = [];
      const stderr: string[] = [];
      child.stderr.on('data', (c: Buffer) => stderr.push(c.toString()));
      const listening = new Promise<number>((resolve, reject) => {
        const rl = createInterface({ input: child.stdout });
        rl.on('line', (line) => {
          let entry: Record<string, unknown>;
          try {
            entry = JSON.parse(line) as Record<string, unknown>;
          } catch {
            reject(new Error(`main.ts printed a non-JSON line: ${line}`));
            return;
          }
          lines.push(entry);
          if (entry['message'] === 'tce dev server listening') resolve(entry['port'] as number);
        });
        child.on('exit', () => reject(new Error(`main.ts exited early: ${stderr.join('')}`)));
      });
      const port = await listening;
      assert.ok(existsSync(dbPath), 'TCE_DB directory and file created');
      const started = lines.find((l) => l['message'] === 'tce dev server listening');
      assert.deepEqual(Object.keys(started ?? {}).filter((k) => /archive/i.test(k)), [], 'no archive settings are logged');
      const reply = await call(port, 'GET', '/v1/dl/lite');
      assert.equal(reply.status, 302);
      const health = await call(port, 'GET', '/v1/health');
      assert.equal(health.status, 200, health.text);
      assert.equal(typeof (JSON.parse(health.text) as HealthResponse).db.bytes, 'number');
      child.kill('SIGTERM');
      assert.equal(await exited, 0, stderr.join(''));
      assert.ok(lines.some((l) => l['message'] === 'stopped' && l['exitCode'] === 0));
    } finally {
      // A failed assertion above must not leave the server running (it would hold the test process open).
      if (running && running.exitCode === null && running.signalCode === null) running.kill('SIGKILL');
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
