// Unit tests for scripts/capacity-sources.mjs with a mocked fetch: the health
// endpoint, the Cloudflare setup rules and the GraphQL / REST parsing.
//   node --test tce/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CF_API,
  cloudflareSetup,
  errorText,
  fetchCloudflareUsage,
  fetchHealth,
  parseD1Size,
  parseHealth,
  sumGraphql,
} from './capacity-sources.mjs';

const HEALTH = { serverTime: 1_762_400_000_000, db: { bytes: 1_234_567, limitBytes: 500_000_000, warnRatio: 0.7, guardRatio: 0.9 }, ingestPaused: false };
const TOKEN = 'tok_SECRET_value_never_printed';
const ACCOUNT = '0123456789abcdef0123456789abcdef';
const DB = '64a28b32-a61f-4ad8-b9a4-c7ae7cea8b66';

/** A Response-like object. `body` undefined -> json() rejects (non-JSON page). */
const reply = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => {
    if (body === undefined) throw new SyntaxError('Unexpected token < in JSON');
    return body;
  },
});

/** A fetch mock recording calls; `route(url, init)` returns a reply or throws. */
function mockFetch(route) {
  const calls = [];
  const fn = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined });
    return route(url, init);
  };
  return { fn, calls };
}

// ---------- health ----------

test('parseHealth accepts a HealthResponse (db.bytes may be null) and rejects other shapes', () => {
  assert.deepEqual(parseHealth(HEALTH), HEALTH);
  assert.deepEqual(parseHealth({ ...HEALTH, db: { ...HEALTH.db, bytes: null } }).db.bytes, null);
  assert.equal(parseHealth(null), null);
  assert.equal(parseHealth({ ...HEALTH, ingestPaused: 'no' }), null);
  assert.equal(parseHealth({ ...HEALTH, db: { ...HEALTH.db, limitBytes: 0 } }), null);
  assert.equal(parseHealth({ ...HEALTH, db: { ...HEALTH.db, warnRatio: 70 } }), null);
  assert.equal(parseHealth({ ...HEALTH, db: { ...HEALTH.db, bytes: -1 } }), null);
  assert.equal(parseHealth({ error: { code: 'not_found', message: 'x' } }), null);
});

test('parseHealth keeps a well-formed retention block and drops a malformed one', () => {
  const retention = { enabled: false, days: { events: 90, errors: 180, reports: 90 }, oldestDays: { events: 80, errors: null, reports: 3 } };
  assert.deepEqual(parseHealth({ ...HEALTH, retention }), { ...HEALTH, retention });
  assert.deepEqual(parseHealth({ ...HEALTH, retention: { ...retention, enabled: 'no' } }), HEALTH);
  assert.deepEqual(parseHealth({ ...HEALTH, retention: { ...retention, oldestDays: { events: -1, errors: null, reports: 3 } } }), HEALTH);
  assert.deepEqual(parseHealth({ ...HEALTH, retention: { ...retention, days: { events: 90 } } }), HEALTH);
});

test('fetchHealth: GET <base>/api/health with a timeout signal; 200 gives the health', async () => {
  const m = mockFetch(() => reply(200, HEALTH));
  const r = await fetchHealth('https://example.test/', { fetch: m.fn });
  assert.deepEqual(r, { ok: true, health: HEALTH });
  assert.equal(m.calls.length, 1);
  assert.equal(m.calls[0].url, 'https://example.test/api/health');
  assert.ok(m.calls[0].init.signal instanceof AbortSignal);
  assert.equal(m.calls[0].init.headers.accept, 'application/json');
});

test('fetchHealth: 404 means the endpoint is not deployed yet', async () => {
  const r = await fetchHealth('https://example.test', { fetch: mockFetch(() => reply(404, { error: { code: 'not_found' } })).fn });
  assert.equal(r.ok, false);
  assert.equal(r.state, 'missing');
  assert.match(r.problem, /^health endpoint not deployed yet \(GET https:\/\/example\.test\/api\/health answered 404\)$/);
});

test('fetchHealth: other statuses, non-JSON and wrong shapes are errors', async () => {
  const r500 = await fetchHealth('https://e.test', { fetch: mockFetch(() => reply(503, {})).fn });
  assert.equal(r500.state, 'error');
  assert.match(r500.problem, /answered HTTP 503/);
  const html = await fetchHealth('https://e.test', { fetch: mockFetch(() => reply(200)).fn });
  assert.match(html.problem, /did not return JSON/);
  const shape = await fetchHealth('https://e.test', { fetch: mockFetch(() => reply(200, { ok: true })).fn });
  assert.match(shape.problem, /not a HealthResponse/);
});

test('fetchHealth: network failures and timeouts are "unreachable", never thrown', async () => {
  const dns = await fetchHealth('https://e.test', {
    fetch: async () => {
      throw new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo ENOTFOUND e.test'), { code: 'ENOTFOUND' }) });
    },
  });
  assert.equal(dns.state, 'unreachable');
  assert.match(dns.problem, /fetch failed \(ENOTFOUND\)$/);
  const slow = await fetchHealth('https://e.test', {
    timeoutMs: 10_000,
    fetch: async () => {
      throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    },
  });
  assert.match(slow.problem, /timed out after 10 s$/);
});

test('fetchHealth: a real timeout aborts a hanging request', async () => {
  const hang = (url, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
  // AbortSignal.timeout's timer is unref'd (a real socket keeps a real request
  // alive); hold the event loop open so Node 22's runner does not cancel.
  const keepAlive = setTimeout(() => {}, 5_000);
  const r = await fetchHealth('https://e.test', { fetch: hang, timeoutMs: 50 });
  clearTimeout(keepAlive);
  assert.equal(r.state, 'unreachable');
  assert.match(r.problem, /timed out after 50 ms$/);
});

test('errorText prefers the cause code', () => {
  assert.equal(errorText(Object.assign(new Error('boom'), { code: 'ECONNREFUSED' })), 'boom (ECONNREFUSED)');
  assert.equal(errorText('plain'), 'plain');
});

// ---------- Cloudflare setup ----------

test('cloudflareSetup: nothing set, one set, Workers Builds and a bad account id skip without reading config', () => {
  const never = () => assert.fail('readTarget must not be called');
  assert.match(cloudflareSetup({}, never).skip, /^Cloudflare usage: skipped \(set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID/);
  assert.match(cloudflareSetup({ CLOUDFLARE_API_TOKEN: ' ', CLOUDFLARE_ACCOUNT_ID: '' }, never).skip, /skipped \(set/);
  assert.match(cloudflareSetup({ CLOUDFLARE_API_TOKEN: TOKEN }, never).skip, /CLOUDFLARE_ACCOUNT_ID is not set/);
  assert.match(cloudflareSetup({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT }, never).skip, /CLOUDFLARE_API_TOKEN is not set/);
  assert.match(cloudflareSetup({ CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, WORKERS_CI: '1' }, never).skip, /Workers Builds/);
  assert.match(cloudflareSetup({ CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'acct/../x' }, never).problem, /32-character hex/);
});

test('cloudflareSetup: both set gives the query; a config error is a problem; the token is never in a message', () => {
  const env = { CLOUDFLARE_API_TOKEN: ` ${TOKEN} `, CLOUDFLARE_ACCOUNT_ID: ACCOUNT };
  assert.deepEqual(cloudflareSetup(env, () => ({ databaseId: DB, scriptName: 'phonecando' })), {
    query: { token: TOKEN, accountId: ACCOUNT, databaseId: DB, scriptName: 'phonecando' },
  });
  const bad = cloudflareSetup(env, () => {
    throw new Error('no d1_databases entry in tce/hosts/cloudflare/wrangler.jsonc');
  });
  assert.equal(bad.problem, 'Cloudflare usage: no d1_databases entry in tce/hosts/cloudflare/wrangler.jsonc');
  for (const r of [cloudflareSetup({ CLOUDFLARE_API_TOKEN: TOKEN }, () => ({})), bad]) assert.ok(!JSON.stringify(r).includes(TOKEN));
});

// ---------- GraphQL and REST parsing ----------

const gql = (dataset, groups) => ({ status: 200, json: { data: { viewer: { accounts: [{ [dataset]: groups }] } }, errors: null } });

test('sumGraphql sums every group (documented response shape)', () => {
  const resp = gql('workersInvocationsAdaptive', [
    { dimensions: { datetime: '2026-11-06T01:00:00Z' }, sum: { errors: 0, requests: 1, subrequests: 0 } },
    { sum: { requests: 4 } },
    { sum: { requests: '3' } },
  ]);
  assert.deepEqual(sumGraphql(resp, 'workersInvocationsAdaptive', ['requests']), { ok: true, values: { requests: 8 } });
  const d1 = gql('d1AnalyticsAdaptiveGroups', [{ sum: { rowsRead: 1200, rowsWritten: 34 } }]);
  assert.deepEqual(sumGraphql(d1, 'd1AnalyticsAdaptiveGroups', ['rowsRead', 'rowsWritten']), { ok: true, values: { rowsRead: 1200, rowsWritten: 34 } });
});

test('sumGraphql: no groups today means zeros', () => {
  assert.deepEqual(sumGraphql(gql('d1AnalyticsAdaptiveGroups', []), 'd1AnalyticsAdaptiveGroups', ['rowsRead', 'rowsWritten']), {
    ok: true,
    values: { rowsRead: 0, rowsWritten: 0 },
  });
});

test('sumGraphql: GraphQL errors explain the missing permission', () => {
  const resp = { status: 200, json: { data: null, errors: [{ message: 'not authorized for that account', path: ['viewer', 'accounts', '0'] }] } };
  const r = sumGraphql(resp, 'd1AnalyticsAdaptiveGroups', ['rowsRead']);
  assert.equal(r.ok, false);
  assert.equal(r.problem, 'not authorized for that account (the token needs Account Analytics: Read)');
  const http = sumGraphql({ status: 403, json: null }, 'x', ['requests']);
  assert.equal(http.problem, 'HTTP 403: no data (the token needs Account Analytics: Read)');
  const other = sumGraphql({ status: 200, json: { errors: [{ message: 'unknown field "rowsRead"' }] } }, 'x', ['rowsRead']);
  assert.equal(other.problem, 'unknown field "rowsRead"');
});

test('sumGraphql: wrong shapes and transport errors', () => {
  assert.match(sumGraphql({ status: 200, json: { data: {} } }, 'x', ['a']).problem, /no data\.viewer\.accounts/);
  assert.match(sumGraphql({ status: 200, json: { data: { viewer: { accounts: [] } } } }, 'x', ['a']).problem, /cannot see this account/);
  assert.match(sumGraphql({ status: 200, json: { data: { viewer: { accounts: [{}] } } } }, 'x', ['a']).problem, /no x\)/);
  assert.deepEqual(sumGraphql({ error: 'request failed: timed out after 10 s' }, 'x', ['a']), { ok: false, problem: 'request failed: timed out after 10 s' });
});

test('parseD1Size reads result.file_size (documented example) and explains failures', () => {
  const ok = { status: 200, json: { errors: [], messages: [], result: { created_at: '2022-11-15T18:25:44.442097Z', file_size: 12, name: 'my-database', num_tables: 12 }, success: true } };
  assert.deepEqual(parseD1Size(ok), { ok: true, bytes: 12 });
  const denied = { status: 403, json: { errors: [{ code: 10000, message: 'Authentication error' }], success: false, result: null } };
  assert.equal(parseD1Size(denied).problem, 'HTTP 403: Authentication error (the token needs D1: Read)');
  assert.equal(parseD1Size({ status: 200, json: { success: true, result: {} } }).problem, 'no file_size in the response');
});

// ---------- the three requests together ----------

/** Routes the mocked Cloudflare API by URL and query name. */
function cloudflareRoute({ d1 = gql('d1AnalyticsAdaptiveGroups', [{ sum: { rowsRead: 5000, rowsWritten: 700 } }]), worker = gql('workersInvocationsAdaptive', [{ sum: { requests: 321 } }]), size = { status: 200, json: { success: true, result: { file_size: 4_096_000 } } } } = {}) {
  return (url, init) => {
    if (url === `${CF_API}/graphql`) {
      const { query } = JSON.parse(init.body);
      const r = query.includes('d1AnalyticsAdaptiveGroups') ? d1 : worker;
      if (r instanceof Error) throw r;
      return reply(r.status, r.json);
    }
    if (url === `${CF_API}/accounts/${ACCOUNT}/d1/database/${DB}`) {
      if (size instanceof Error) throw size;
      return reply(size.status, size.json);
    }
    throw new Error(`unexpected URL ${url}`);
  };
}

test('fetchCloudflareUsage: three authenticated requests for today (UTC), parsed', async () => {
  const m = mockFetch(cloudflareRoute());
  const now = Date.parse('2026-11-06T13:45:10.000Z');
  const r = await fetchCloudflareUsage({ token: TOKEN, accountId: ACCOUNT, databaseId: DB, scriptName: 'phonecando' }, { fetch: m.fn, now });
  assert.deepEqual(r, {
    day: '2026-11-06',
    d1: { ok: true, values: { rowsRead: 5000, rowsWritten: 700 } },
    worker: { ok: true, values: { requests: 321 } },
    size: { ok: true, bytes: 4_096_000 },
  });
  assert.equal(m.calls.length, 3);
  for (const c of m.calls) {
    assert.equal(c.init.headers.authorization, `Bearer ${TOKEN}`);
    assert.ok(c.init.signal instanceof AbortSignal);
  }
  const [d1, worker] = m.calls.filter((c) => c.body).sort((a, b) => a.body.query.localeCompare(b.body.query));
  assert.match(d1.body.query, /d1AnalyticsAdaptiveGroups\(limit: 10000, filter: \{ date_geq: \$start, date_leq: \$end, databaseId: \$databaseId \}\)/);
  assert.match(d1.body.query, /sum \{ rowsRead rowsWritten \}/);
  assert.deepEqual(d1.body.variables, { accountTag: ACCOUNT, start: '2026-11-06', end: '2026-11-06', databaseId: DB });
  assert.match(worker.body.query, /workersInvocationsAdaptive\(limit: 10000, filter: \{ scriptName: \$scriptName, datetime_geq: \$datetimeStart, datetime_leq: \$datetimeEnd \}\)/);
  assert.deepEqual(worker.body.variables, { accountTag: ACCOUNT, datetimeStart: '2026-11-06T00:00:00Z', datetimeEnd: '2026-11-06T13:45:10.000Z', scriptName: 'phonecando' });
  assert.equal(m.calls.find((c) => !c.body).init.method, undefined, 'the size lookup is a GET');
});

test('fetchCloudflareUsage: one failing part leaves the others; no message carries the token', async () => {
  const route = cloudflareRoute({
    worker: { status: 200, json: { data: null, errors: [{ message: 'not authorized' }] } },
    size: Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } }),
  });
  const r = await fetchCloudflareUsage({ token: TOKEN, accountId: ACCOUNT, databaseId: DB, scriptName: 'phonecando' }, { fetch: mockFetch(route).fn, now: 0 });
  assert.equal(r.day, '1970-01-01');
  assert.equal(r.d1.ok, true);
  assert.equal(r.worker.problem, 'not authorized (the token needs Account Analytics: Read)');
  assert.equal(r.size.problem, 'request failed: fetch failed (ECONNRESET)');
  assert.ok(!JSON.stringify(r).includes(TOKEN));
});
