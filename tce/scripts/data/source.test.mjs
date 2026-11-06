import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { CF_API, chooseSource, cliSource, namedResults, tokenSource } from './source.mjs';

const TOKEN = 'tok_SECRET_never_printed';
const ACCOUNT = '0123456789abcdef0123456789abcdef';
const DB = '64a28b32-a61f-4ad8-b9a4-c7ae7cea8b66';
const STATEMENTS = [
  { name: 'one', sql: 'SELECT 1 AS a' },
  { name: 'two', sql: 'SELECT 2 AS b' },
];

test('chooseSource: never under GitHub Actions or Workers Builds, token or not', () => {
  assert.match(chooseSource({ GITHUB_ACTIONS: 'true', TCE_READ_TOKEN: TOKEN }).skip, /GitHub Actions/);
  assert.match(chooseSource({ WORKERS_CI: '1' }).skip, /Workers Builds/);
  assert.match(chooseSource({ WORKERS_CI: '1', TCE_READ_TOKEN: TOKEN, CLOUDFLARE_API_TOKEN: TOKEN }).skip, /stays out of Cloudflare build logs/);
});

test('chooseSource: locally a token wins, else the cf CLI', () => {
  assert.deepEqual(chooseSource({ CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT }), { kind: 'token', token: TOKEN, accountId: ACCOUNT });
  assert.deepEqual(chooseSource({ TCE_READ_TOKEN: TOKEN, CLOUDFLARE_API_TOKEN: 'other' }), { kind: 'token', token: TOKEN, accountId: null });
  assert.deepEqual(chooseSource({}), { kind: 'cli' });
  assert.match(chooseSource({ TCE_READ_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: 'nope' }).skip, /32-character/);
});

test('namedResults maps result sets onto names and sums rows read', () => {
  const r = namedResults(STATEMENTS, [
    { success: true, results: [{ a: 1 }], meta: { rows_read: 3 } },
    { success: true, results: [], meta: { rows_read: 4 } },
  ]);
  assert.deepEqual(r, { results: { one: [{ a: 1 }], two: [] }, rowsRead: 7 });
  assert.throws(() => namedResults(STATEMENTS, [{ success: true }]), /1 result sets for 2/);
  assert.throws(() => namedResults(STATEMENTS, [{ success: true }, { success: false, error: 'no such table' }]), /query "two" failed/);
});

/** A fetch fake that records calls and answers from `routes(url, init)` → [status, body]. */
function fakeFetch(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const [status, body] = routes(String(url), init);
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

test('tokenSource: one D1 batch with the bearer token, account found when there is only one', async () => {
  const f = fakeFetch((url) => {
    if (url.endsWith('/accounts?per_page=5')) return [200, { success: true, result: [{ id: ACCOUNT }] }];
    return [200, { success: true, result: [{ success: true, results: [{ a: 1 }], meta: { rows_read: 1 } }, { success: true, results: [{ b: 2 }], meta: { rows_read: 1 } }] }];
  });
  const src = tokenSource({ token: TOKEN, accountId: null }, { fetch: f.fetch });
  const out = await src.d1(DB, STATEMENTS);
  assert.deepEqual(out.results, { one: [{ a: 1 }], two: [{ b: 2 }] });
  const q = f.calls[1];
  assert.equal(q.url, `${CF_API}/accounts/${ACCOUNT}/d1/database/${DB}/query`);
  assert.equal(q.init.method, 'POST');
  assert.equal(q.init.headers.authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(q.init.body), { sql: 'SELECT 1 AS a;\nSELECT 2 AS b' });
});

test('tokenSource: a forbidden token names the permission and never echoes the token', async () => {
  const f = fakeFetch(() => [403, { success: false, errors: [{ message: 'Authentication error' }] }]);
  const src = tokenSource({ token: TOKEN, accountId: ACCOUNT }, { fetch: f.fetch });
  await assert.rejects(src.d1(DB, STATEMENTS), (e) => /HTTP 403: Authentication error \(the token needs D1: Read\)/.test(e.message) && !e.message.includes(TOKEN));
});

test('tokenSource: several accounts ask for CLOUDFLARE_ACCOUNT_ID', async () => {
  const f = fakeFetch(() => [200, { success: true, result: [{ id: 'a' }, { id: 'b' }] }]);
  await assert.rejects(tokenSource({ token: TOKEN, accountId: null }, { fetch: f.fetch }).d1(DB, STATEMENTS), /set CLOUDFLARE_ACCOUNT_ID/);
});

test('tokenSource.ae: each query on its own; a failure is a problem, not an exception', async () => {
  const f = fakeFetch((url, init) => (init.body.includes('bad') ? [403, { errors: [{ message: 'not authorized' }] }] : [200, { data: [{ n: 1 }] }]));
  const src = tokenSource({ token: TOKEN, accountId: ACCOUNT }, { fetch: f.fetch });
  const out = await src.ae([
    { name: 'good', sql: 'SELECT 1 AS n' },
    { name: 'broken', sql: "SELECT 'bad' AS n" },
  ]);
  assert.deepEqual(out.results, { good: [{ n: 1 }] });
  assert.match(out.problem, /Account Analytics: Read/);
  assert.equal(f.calls[0].url, `${CF_API}/accounts/${ACCOUNT}/analytics_engine/sql`);
});

/** A spawn fake: answers with `code`, `stdout`, or an 'error' event. */
function fakeSpawn({ code = 0, stdout = '', stderr = '', error = null } = {}) {
  const calls = [];
  const spawn = (cmd, args) => {
    calls.push([cmd, ...args]);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    setImmediate(() => {
      if (error) return child.emit('error', error);
      child.stdout.end(stdout);
      child.stderr.end(stderr);
      child.emit('close', code);
    });
    return child;
  };
  return { spawn, calls };
}

test('cliSource: one cf d1 query call with every statement', async () => {
  const s = fakeSpawn({ stdout: JSON.stringify([{ success: true, results: [{ a: 1 }], meta: { rows_read: 2 } }, { success: true, results: [], meta: { rows_read: 1 } }]) });
  const out = await cliSource({ spawn: s.spawn }).d1(DB, STATEMENTS);
  assert.deepEqual(out, { results: { one: [{ a: 1 }], two: [] }, rowsRead: 3 });
  assert.deepEqual(s.calls[0], ['cf', 'd1', 'query', DB, '--sql', 'SELECT 1 AS a;\nSELECT 2 AS b']);
});

test('cliSource: missing CLI, failed command and non-JSON output explain themselves', async () => {
  await assert.rejects(cliSource({ spawn: fakeSpawn({ error: Object.assign(new Error('spawn cf ENOENT'), { code: 'ENOENT' }) }).spawn }).d1(DB, STATEMENTS), /not on PATH/);
  await assert.rejects(cliSource({ spawn: fakeSpawn({ code: 1, stderr: 'not logged in' }).spawn }).d1(DB, STATEMENTS), /exited 1: not logged in/);
  await assert.rejects(cliSource({ spawn: fakeSpawn({ stdout: 'Welcome!' }).spawn }).d1(DB, STATEMENTS), /other than JSON/);
  const ae = await cliSource({ spawn: fakeSpawn().spawn }).ae([]);
  assert.match(ae.problem, /needs TCE_READ_TOKEN/);
});
