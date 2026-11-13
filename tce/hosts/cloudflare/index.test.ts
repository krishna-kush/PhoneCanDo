// The Worker's exported fetch and scheduled handlers over local D1
// (worker.test-support.ts): every op route end to end, the site_daily rollup
// behind hits and downloads, GET /v1/health, the static-site fallback and the
// cron ops. index-limits.test.ts covers rate limiting. Tests run in order and
// share one database.

import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';

import { CAPACITY, LIMITS, RETENTION_DAYS } from '../../core/schema/limits.ts';
import type { BatchResponse, ErrorBody, ForgetResponse, HealthResponse, ReportResponse, ShareStatsResponse } from '../../core/schema/wire.ts';
import {
  batchRequest,
  DAY_MS,
  DEVICE_ID_2,
  DEVICE_PROOF_2,
  DEVICE_VERIFIER_2,
  errorRow,
  eventRow,
  eventWire,
  forgetRequest,
  hitRequest,
  identityWire,
  INSTALL_ID_3,
  REPORT_ID_2,
  reportRequest,
  reportRow,
  SHARE_CODE,
  SHARE_CODE_2,
  SITE_ORIGIN,
  STRANGER_PROOF,
} from '../../testkit/fixtures.ts';
import worker from './index.ts';
import { ADDRESS_NEEDLES, BASE, CLIENT_IP, MIGRATIONS, SITE_BASE, cfRequest, stream, useWorker } from './worker.test-support.ts';

/** The retention op's cron, from the registry (wrangler.test.ts pins it to wrangler.jsonc). */

describe('Cloudflare host (index.ts) over getPlatformProxy', () => {
  const w = useWorker();
  const { assets, call, count, ctx, downloads, logs, pageviews, pending, postJson, printed, rollup } = w;

  it('has the eight tables from migration 0001, the verifier column from 0002, site_daily from 0003 and the share tables from 0004', async () => {
    assert.deepEqual(
      MIGRATIONS.map((m) => m.name).slice(0, 4),
      ['0001_init.sql', '0002_ownership_indexes.sql', '0003_site_daily.sql', '0004_share.sql'],
    );
    const rows = await w.env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name").all<{ name: string }>();
    assert.deepEqual(
      rows.results.map((r) => r.name).filter((n) => n !== 'd1_migrations' && !n.startsWith('sqlite_')),
      [
        'devices',
        'errors',
        'events',
        'github_assets_daily',
        'github_repo_daily',
        'installs',
        'reports',
        'sessions',
        'share_daily',
        'share_installs',
        'share_links',
        'site_daily',
      ],
    );
    const cols = await w.env.DB.prepare('PRAGMA table_info(devices)').all<{ name: string }>();
    assert.ok(cols.results.some((c) => c.name === 'verifier'));
  });

  it('accepts a batch into D1 with edge facts from request.cf and no IP', async () => {
    const res = await postJson('/v1/batch', batchRequest());
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.match(String(res.headers.get('content-type')), /^application\/json/);
    const body = (await res.json()) as BatchResponse;
    assert.deepEqual(body.accepted, { sessions: 1, events: 2, errors: 1 });
    assert.deepEqual(
      { devices: await count('devices'), installs: await count('installs'), sessions: await count('sessions'), events: await count('events'), errors: await count('errors') },
      { devices: 1, installs: 1, sessions: 1, events: 2, errors: 1 },
    );
    const device = await w.env.DB.prepare('SELECT country, asn, verifier FROM devices').first<{ country: string; asn: number; verifier: string }>();
    assert.deepEqual(device, { country: 'IN', asn: 24560, verifier: batchRequest().identity.deviceVerifier });
    for (const table of ['devices', 'installs', 'sessions', 'events', 'errors']) {
      const all = await w.env.DB.prepare(`SELECT * FROM ${table}`).all();
      assert.ok(!JSON.stringify(all.results).includes(CLIENT_IP), `${table} must not contain the client IP`);
    }
  });

  it('treats a replayed batch as nothing new', async () => {
    const res = await postJson('/v1/batch', batchRequest());
    assert.equal(res.status, 200);
    const body = (await res.json()) as BatchResponse;
    assert.equal(body.accepted.events, 0);
    assert.equal(body.accepted.errors, 0);
    assert.equal(await count('events'), 2);
  });

  it('writes a page view point and bumps site_daily for an allowed Origin (204); refuses one without (403)', async () => {
    const ok = await call('/v1/hit', {
      method: 'POST',
      body: JSON.stringify(hitRequest()),
      headers: { 'content-type': 'text/plain;charset=UTF-8', origin: SITE_ORIGIN },
    });
    assert.equal(ok.status, 204, await ok.clone().text());
    assert.equal(await ok.text(), '');
    assert.equal(pageviews.calls.length, 1);
    assert.ok(!JSON.stringify(pageviews.calls).includes(CLIENT_IP));
    const refused = await call('/v1/hit', { method: 'POST', body: JSON.stringify(hitRequest()), headers: { 'content-type': 'text/plain' } });
    assert.equal(refused.status, 403);
    assert.equal(((await refused.json()) as ErrorBody).error.code, 'forbidden');
    assert.equal(pageviews.calls.length, 1);
    assert.deepEqual(await rollup(), [{ kind: 'view', key: '/install', country: 'IN', count: 1 }], 'only the allowed hit counted');
    const day = await w.env.DB.prepare('SELECT day FROM site_daily').first<{ day: string }>();
    assert.match(String(day?.day), /^\d{4}-\d{2}-\d{2}$/);
  });

  it('counts two page views of a path on one site_daily row', async () => {
    const res = await call('/v1/hit', {
      method: 'POST',
      body: JSON.stringify(hitRequest()),
      headers: { 'content-type': 'text/plain;charset=UTF-8', origin: SITE_ORIGIN },
    });
    assert.equal(res.status, 204, await res.clone().text());
    assert.deepEqual(await rollup(), [{ kind: 'view', key: '/install', country: 'IN', count: 2 }]);
  });

  it('counts a download (AE point and site_daily) and redirects /v1/dl/lite to the GitHub asset', async () => {
    const res = await call('/v1/dl/lite', { headers: { referer: 'https://www.google.com/', 'sec-fetch-mode': 'navigate' } });
    assert.equal(res.status, 302);
    const location = String(res.headers.get('location'));
    assert.match(location, /^https:\/\/github\.com\/krishna-kush\/PhoneCanDo\/releases\/download\/v\d+\.\d+\.\d+\/.+lite.+\.apk$/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.equal(downloads.calls.length, 1);
    const unknown = await call('/v1/dl/beta');
    assert.equal(unknown.status, 404);
    assert.equal(downloads.calls.length, 1);
    assert.deepEqual(await rollup(), [
      { kind: 'download', key: 'lite', country: 'IN', count: 1 },
      { kind: 'view', key: '/install', country: 'IN', count: 2 },
    ]);
  });

  it('redirects a download that is not a browser navigation without counting it, keeping it in Analytics Engine as a bot', async () => {
    const before = downloads.calls.length;
    const counted = await rollup();
    const cases: Array<Record<string, string>> = [{}, { 'sec-fetch-mode': 'cors' }, { 'sec-fetch-mode': 'navigate', 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }];
    for (const headers of cases) {
      const res = await call('/v1/dl/full', { headers });
      assert.equal(res.status, 302);
    }
    assert.deepEqual(await rollup(), counted);
    const points = downloads.calls.slice(before);
    assert.equal(points.length, 3);
    // blob6 is the client class (stores/cloudflare/analytics.ts).
    assert.deepEqual(points.map((p) => p?.blobs?.[5]), ['bot', 'bot', 'bot']);
  });

  it('counts a share link opened on the site host, and a download from its page, then sends the browser home with the code', async () => {
    const res = await call(`/i/${SHARE_CODE}`, { base: SITE_BASE, headers: { 'sec-fetch-mode': 'navigate' } });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), `/?i=${SHARE_CODE}`);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    // A chat app's link preview (no Sec-Fetch-Mode) still redirects, uncounted.
    assert.equal((await call(`/i/${SHARE_CODE}`, { base: SITE_BASE })).status, 302);
    const dl = await call(`/v1/dl/lite?i=${SHARE_CODE}`, { headers: { 'sec-fetch-mode': 'navigate' } });
    assert.equal(dl.status, 302);
    assert.deepEqual((await w.env.DB.prepare('SELECT code, step, count FROM share_daily ORDER BY step').all()).results, [
      { code: SHARE_CODE, step: 'download', count: 1 },
      { code: SHARE_CODE, step: 'open', count: 1 },
    ]);
  });

  it('answers /i/* only on the site host: on the API host it is the static site', async () => {
    const before = assets.calls.length;
    const res = await call(`/i/${SHARE_CODE}`, { headers: { 'sec-fetch-mode': 'navigate' } });
    assert.equal(res.status, 200);
    assert.deepEqual(assets.calls.slice(before), [`${BASE}/i/${SHARE_CODE}`]);
    assert.equal(await count('share_daily'), 2, 'nothing more counted');
  });

  it('registers a link from a share.sent event and answers POST /v1/share/stats with each link’s counts', async () => {
    const sent = await postJson(
      '/v1/batch',
      batchRequest({
        batchId: '22222222-3333-4444-8555-666666666666',
        events: [eventWire({ seq: 9, name: 'share.sent', props: { code: SHARE_CODE } })],
      }),
    );
    assert.equal(sent.status, 200, await sent.clone().text());
    assert.deepEqual((await w.env.DB.prepare('SELECT code, device_id FROM share_links').all()).results, [
      { code: SHARE_CODE, device_id: identityWire().deviceId },
    ]);
    const res = await postJson('/v1/share/stats', { codes: [SHARE_CODE, SHARE_CODE_2] });
    assert.equal(res.status, 200, await res.clone().text());
    assert.deepEqual(((await res.json()) as ShareStatsResponse).links, [
      { code: SHARE_CODE, opened: 1, downloaded: 1, installed: 0, using: 0, lastDay: new Date().toISOString().slice(0, 10) },
      { code: SHARE_CODE_2, opened: 0, downloaded: 0, installed: 0, using: 0, lastDay: null },
    ]);
    assert.equal((await postJson('/v1/share/stats', { codes: ['nope'] })).status, 400);
  });

  it('answers GET /v1/health with the database size from D1, the capacity ratios and no caching', async () => {
    const res = await call('/v1/health');
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(res.headers.get('cache-control'), 'no-store');
    assert.match(String(res.headers.get('content-type')), /^application\/json/);
    const body = (await res.json()) as HealthResponse;
    assert.equal(typeof body.db.bytes, 'number');
    assert.ok(body.db.bytes! > 0 && body.db.bytes! < CAPACITY.dbLimitBytes * CAPACITY.warnRatio, String(body.db.bytes));
    assert.deepEqual(
      { limitBytes: body.db.limitBytes, warnRatio: body.db.warnRatio, guardRatio: body.db.guardRatio, ingestPaused: body.ingestPaused },
      { limitBytes: CAPACITY.dbLimitBytes, warnRatio: CAPACITY.warnRatio, guardRatio: CAPACITY.guardRatio, ingestPaused: false },
    );
    assert.ok(Math.abs(body.serverTime - Date.now()) < 60_000);
    assert.ok(!JSON.stringify(body).includes(CLIENT_IP));
    const wrong = await call('/v1/health', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.get('allow'), 'GET, HEAD');
  });

  it('stores a report', async () => {
    const res = await postJson('/v1/report', reportRequest());
    assert.equal(res.status, 200, await res.clone().text());
    assert.equal(((await res.json()) as ReportResponse).reportId, reportRequest().reportId);
    assert.equal(await count('reports'), 1);
  });

  it('forgets every row of the device', async () => {
    const res = await postJson('/v1/forget', forgetRequest());
    assert.equal(res.status, 200, await res.clone().text());
    const { deleted } = (await res.json()) as ForgetResponse;
    assert.equal(deleted['events'], 3);
    assert.equal(deleted['reports'], 1);
    // The link it sent, with its open and download counts.
    assert.equal(deleted['share_links'], 1);
    assert.equal(deleted['share_daily'], 2);
    for (const table of ['devices', 'installs', 'sessions', 'events', 'errors', 'reports', 'share_links', 'share_daily']) {
      assert.equal(await count(table), 0, table);
    }
    const again = await postJson('/v1/forget', forgetRequest());
    assert.equal(again.status, 404);
  });

  it('a phone that only ever sent a report is pinned by it in D1, and Delete my data removes the report', async () => {
    const identity = identityWire({ installId: INSTALL_ID_3, deviceId: DEVICE_ID_2, deviceVerifier: DEVICE_VERIFIER_2 });
    const sent = await postJson('/v1/report', reportRequest({ reportId: REPORT_ID_2, identity, sessionId: null }));
    assert.equal(sent.status, 200, await sent.clone().text());
    assert.deepEqual(await w.env.DB.prepare('SELECT device_id, verifier, country, asn FROM devices').all().then((r) => r.results), [
      { device_id: DEVICE_ID_2, verifier: DEVICE_VERIFIER_2, country: 'IN', asn: 24560 },
    ]);
    const wrong = await postJson('/v1/forget', forgetRequest({ deviceId: DEVICE_ID_2, deviceProof: STRANGER_PROOF }));
    assert.equal(wrong.status, 404);
    assert.equal(await count('reports'), 1);
    const res = await postJson('/v1/forget', forgetRequest({ deviceId: DEVICE_ID_2, deviceProof: DEVICE_PROOF_2 }));
    assert.equal(res.status, 200, await res.clone().text());
    assert.deepEqual(((await res.json()) as ForgetResponse).deleted, {
      events: 0,
      errors: 0,
      reports: 1,
      share_daily: 0,
      share_installs: 0,
      share_links: 0,
      sessions: 0,
      installs: 0,
      devices: 1,
    });
    for (const table of ['devices', 'reports']) assert.equal(await count(table), 0, table);
  });

  it('rejects an oversized body by Content-Length and while streaming (413)', async () => {
    const byHeader = await call('/v1/batch', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json', 'content-length': String(LIMITS.batchBodyBytes + 1) },
    });
    assert.equal(byHeader.status, 413);
    assert.equal(((await byHeader.json()) as ErrorBody).error.code, 'too_large');
    const byStream = await call('/v1/batch', { method: 'POST', body: stream(LIMITS.batchBodyBytes + 5000), headers: { 'content-type': 'application/json' } });
    assert.equal(byStream.status, 413);
    assert.equal(((await byStream.json()) as ErrorBody).error.message, `body is over the ${LIMITS.batchBodyBytes}-byte limit`);
  });

  it('rejects invalid JSON with 400 and echoes cf-ray as the request id', async () => {
    const res = await call('/v1/batch', { method: 'POST', body: '{"schema":', headers: { 'content-type': 'application/json', 'cf-ray': '8f00aa11bb22cc33-BLR' } });
    assert.equal(res.status, 400);
    assert.deepEqual(((await res.json()) as ErrorBody).error, { code: 'bad_request', message: 'body is not valid JSON', requestId: '8f00aa11bb22cc33-BLR' });
  });

  it('answers unknown op paths with 404 and wrong methods with 405 + Allow', async () => {
    const missing = await call('/v1/nope');
    assert.equal(missing.status, 404);
    assert.equal(missing.headers.get('cache-control'), 'no-store');
    const wrong = await call('/v1/batch');
    assert.equal(wrong.status, 405);
    assert.equal(wrong.headers.get('allow'), 'POST');
  });

  it('hands every other path to ASSETS untouched', async () => {
    const before = assets.calls.length;
    for (const path of ['/', '/privacy/', '/v1x', '/v1']) {
      const res = await call(path);
      assert.equal(res.status, 200);
      assert.match(await res.text(), /PhoneCanDo/);
    }
    assert.deepEqual(assets.calls.slice(before), [`${BASE}/`, `${BASE}/privacy/`, `${BASE}/v1x`, `${BASE}/v1`]);
  });

  it('answers /v1/* only on the API host: on the site host it is the static site', async () => {
    const before = assets.calls.length;
    const counted = { downloads: downloads.calls.length, rollup: await rollup() };
    for (const path of ['/v1/health', '/v1/dl/lite', '/v1/batch']) {
      const res = await call(path, { base: SITE_BASE, method: path === '/v1/batch' ? 'POST' : 'GET', body: path === '/v1/batch' ? '{}' : undefined });
      assert.equal(res.status, 200);
      assert.match(await res.text(), /PhoneCanDo/);
    }
    assert.deepEqual(assets.calls.slice(before), [`${SITE_BASE}/v1/health`, `${SITE_BASE}/v1/dl/lite`, `${SITE_BASE}/v1/batch`]);
    assert.deepEqual({ downloads: downloads.calls.length, rollup: await rollup() }, counted);
    // The same path on the API host is the op (HEAD redirects without counting).
    assert.equal((await call('/v1/dl/lite', { method: 'HEAD' })).status, 302);
  });

  it('answers /v1/* on every host when API_HOSTS is unset (local dev)', async () => {
    const { API_HOSTS: _, ...open } = w.env;
    const res = await call('/v1/health', { base: SITE_BASE }, open as typeof w.env);
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as { db: { limitBytes: number } }).db.limitBytes, CAPACITY.dbLimitBytes);
  });

  it('works without request.cf (edge facts become null)', async () => {
    const res = await postJson('/v1/batch', batchRequest({ batchId: '11111111-2222-4333-8444-555555555555' }), {});
    assert.equal(res.status, 200);
    const noCf = await worker.fetch(cfRequest('/v1/nope', { cf: null }) as Request<unknown, IncomingRequestCfProperties>, w.env, ctx);
    assert.equal(noCf.status, 404);
    assert.match(String(((await noCf.json()) as ErrorBody).error.requestId), /^[0-9a-f-]{36}$/);
  });

  it('scheduled() for the old retention schedule runs nothing and deletes nothing (retention is not scheduled)', async () => {
    const now = Date.now();
    const old = now - (RETENTION_DAYS.errors + 5) * DAY_MS;
    await w.env.DB.prepare(
      'INSERT INTO reports (report_id, install_id, device_id, session_id, version, channel, note, events, log_tail, device, received) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    )
      .bind('aaaaaaaa-0000-4000-8000-0000000000aa', 'i', 'd', null, '1', 'full', null, '[]', null, '{}', old)
      .run();
    const before = await count('reports');
    const retentionRuns = logs('cron op done').filter((l) => l['op'] === 'retention').length;
    pending.length = 0;
    // Even with deletion switched on, the Worker has no op for this schedule any more.
    worker.scheduled({ cron: '*/15 * * * *', scheduledTime: now, noRetry: () => undefined }, { ...w.env, RETENTION_ENABLED: 'true' }, ctx);
    await Promise.all(pending);
    assert.equal(await count('reports'), before, 'nothing deleted');
    assert.equal(logs('cron op done').filter((l) => l['op'] === 'retention').length, retentionRuns, 'retention did not run');
    await w.env.DB.prepare('DELETE FROM reports WHERE report_id = ?').bind('aaaaaaaa-0000-4000-8000-0000000000aa').run();
  });

  it('scheduled() runs github_daily on its cron through the global fetch into D1', async () => {
    let retentionRuns = 0;
    const repo = 'https://api.github.com/repos/krishna-kush/PhoneCanDo';
    const calls: Array<{ url: string; userAgent: string | null }> = [];
    const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
    const fetchMock = mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      calls.push({ url, userAgent: new Headers(init?.headers).get('user-agent') });
      if (url.startsWith(`${repo}/releases`)) {
        return reply([
          {
            tag_name: 'v0.1.2',
            draft: false,
            assets: [
              { name: 'phonecando-0.1.2-lite-arm64.apk', download_count: 3 },
              { name: 'phonecando-0.1.2-full-arm64.apk', download_count: 4 },
            ],
          },
        ]);
      }
      if (url === repo) return reply({ stargazers_count: 12, forks_count: 2, subscribers_count: 3 });
      return reply({ message: 'Not Found' }, 404);
    });
    try {
      pending.length = 0;
      retentionRuns = logs('cron op done').filter((l) => l['op'] === 'retention').length;
      worker.scheduled({ cron: '17 3 * * *', scheduledTime: Date.now(), noRetry: () => undefined }, w.env, ctx);
      await Promise.all(pending);
    } finally {
      fetchMock.mock.restore();
    }
    assert.ok(calls.length >= 2, JSON.stringify(calls));
    for (const c of calls) {
      assert.ok(c.url.startsWith('https://api.github.com/'), c.url);
      assert.equal(c.userAgent, 'phonecando-tce');
    }
    const done = logs('cron op done').filter((l) => l['op'] === 'github_daily');
    assert.equal(done.length, 1, JSON.stringify(logs('cron op failed')));
    assert.deepEqual((done[0]?.['result'] as Record<string, unknown>)['assets'], 2);
    const assetRows = await w.env.DB.prepare('SELECT asset, download_count FROM github_assets_daily ORDER BY asset').all();
    assert.deepEqual(assetRows.results, [
      { asset: 'phonecando-0.1.2-full-arm64.apk', download_count: 4 },
      { asset: 'phonecando-0.1.2-lite-arm64.apk', download_count: 3 },
    ]);
    const repoRow = await w.env.DB.prepare('SELECT stars, forks, watchers, views FROM github_repo_daily').first();
    assert.deepEqual(repoRow, { stars: 12, forks: 2, watchers: 3, views: null });
    assert.equal(logs('cron op done').filter((l) => l['op'] === 'retention').length, retentionRuns, 'retention did not run again');
  });

  it('never stores the client address: no D1 row, no analytics point', async () => {
    for (const table of ['devices', 'installs', 'sessions', 'events', 'errors', 'reports', 'github_assets_daily', 'github_repo_daily', 'site_daily']) {
      const all = JSON.stringify((await w.env.DB.prepare(`SELECT * FROM ${table}`).all()).results);
      for (const needle of ADDRESS_NEEDLES) assert.ok(!all.includes(needle), `${table} contains ${needle}`);
    }
    const points = JSON.stringify([pageviews.calls, downloads.calls]);
    for (const needle of ADDRESS_NEEDLES) assert.ok(!points.includes(needle), `an analytics point contains ${needle}`);
  });

  it('scheduled() with an unknown cron runs nothing and warns', async () => {
    const warnedBefore = logs('no cron op for schedule').length;
    pending.length = 0;
    worker.scheduled({ cron: '1 2 3 4 5', scheduledTime: Date.now(), noRetry: () => undefined }, w.env, ctx);
    await Promise.all(pending);
    assert.equal(logs('no cron op for schedule').length, warnedBefore + 1);
    assert.equal(logs('cron finished').at(-1)?.['ops'], 0);
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
