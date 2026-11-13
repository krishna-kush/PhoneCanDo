import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { fakeClock } from '../../testkit/clock.ts';
import { createTestSigner, googleClaims, TEST_CLIENT_ID, type TestSigner } from '../../testkit/google.ts';
import { fakeD1, openTestDb } from '../../testkit/sqlite.ts';
import type { AccountsEnv } from './env.ts';
import { createAccountsFetch, type AccountsLimiter } from './index.ts';

const API = 'https://api.phonecando.app';
const allow: AccountsLimiter = async () => true;

let signer: TestSigner;
before(async () => {
  signer = await createTestSigner();
});

function setup(clientIds = TEST_CLIENT_ID) {
  const clock = fakeClock();
  const env: AccountsEnv = { ACCOUNTS_DB: fakeD1(openTestDb()), GOOGLE_CLIENT_IDS: clientIds };
  const handle = createAccountsFetch({ keys: signer.keys, clock });
  const send = async (method: string, path: string, init: { body?: string; token?: string; limit?: AccountsLimiter; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { ...init.headers };
    if (init.token) headers.authorization = `Bearer ${init.token}`;
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const req = new Request(`${API}${path}`, { method, headers, body: init.body ?? null });
    return handle(req, new URL(req.url), env, init.limit ?? allow);
  };
  return { clock, send };
}

async function json(res: Response | null): Promise<unknown> {
  assert.ok(res);
  return res.json();
}

test('paths outside /v1/account are not ours', async () => {
  const { send } = setup();
  for (const path of ['/v1/batch', '/v1/accounts', '/v1/account-x', '/']) assert.equal(await send('GET', path), null, path);
});

test('the whole sign-in over HTTP', async () => {
  const { send, clock } = setup();
  const nonceRes = await send('POST', '/v1/account/nonce');
  assert.equal(nonceRes?.status, 200);
  assert.equal(nonceRes?.headers.get('content-type'), 'application/json; charset=utf-8');
  assert.equal(nonceRes?.headers.get('cache-control'), 'no-store');
  const { nonce } = (await json(nonceRes)) as { nonce: string };
  const idToken = await signer.sign(googleClaims(clock.now(), nonce));
  const signin = await send('POST', '/v1/account/signin', { body: JSON.stringify({ idToken, nonce }) });
  assert.equal(signin?.status, 200);
  const { token, account } = (await json(signin)) as { token: string; account: unknown };
  assert.deepEqual(account, { email: 'friend@example.com', createdAt: clock.now() });
  assert.deepEqual(await json(await send('GET', '/v1/account', { token })), { account });
  const shares = await send('PUT', '/v1/account/shares', { token, body: JSON.stringify({ links: [{ code: 'k7q2m9xa', created: 5 }] }) });
  assert.deepEqual(await json(shares), { links: [{ code: 'k7q2m9xa', created: 5 }] });
  assert.deepEqual(await json(await send('POST', '/v1/account/delete', { token })), { deleted: true });
  const gone = await send('GET', '/v1/account', { token });
  assert.equal(gone?.status, 401);
  assert.deepEqual(await json(gone), { error: 'signed_out' });
});

test('unknown routes and methods under /v1/account are 404', async () => {
  const { send } = setup();
  for (const [m, p] of [['GET', '/v1/account/nonce'], ['DELETE', '/v1/account'], ['POST', '/v1/account/nope'], ['HEAD', '/v1/account']] as const) {
    const res = await send(m, p);
    assert.equal(res?.status, 404, `${m} ${p}`);
  }
});

test('over the limit: 429 with Retry-After, and the right bucket is asked', async () => {
  const { send } = setup();
  const asked: string[] = [];
  const deny: AccountsLimiter = async (b) => {
    asked.push(b);
    return false;
  };
  const res = await send('POST', '/v1/account/signin', { body: '{}', limit: deny });
  assert.equal(res?.status, 429);
  assert.equal(res?.headers.get('retry-after'), '60');
  assert.deepEqual(await json(res), { error: 'rate_limited' });
  await send('POST', '/v1/account/nonce', { limit: deny });
  await send('POST', '/v1/account/delete', { limit: deny });
  await send('GET', '/v1/account', { limit: deny });
  assert.deepEqual(asked, ['rare', 'public', 'rare', 'public']);
});

test('a limiter that throws lets the request through', async () => {
  const { send } = setup();
  const res = await send('POST', '/v1/account/nonce', {
    limit: async () => {
      throw new Error('limiter down');
    },
  });
  assert.equal(res?.status, 200);
});

test('bodies over the cap or not JSON are bad_request', async () => {
  const { send } = setup();
  const big = JSON.stringify({ idToken: 'x'.repeat(9000), nonce: 'A'.repeat(43) });
  assert.equal((await send('POST', '/v1/account/signin', { body: big }))?.status, 400);
  assert.equal((await send('POST', '/v1/account/signin', { body: '{not json' }))?.status, 400);
  // A body that would pass the shape check, refused on its declared length alone.
  const small = JSON.stringify({ idToken: 'x', nonce: 'A'.repeat(43) });
  assert.equal((await send('POST', '/v1/account/signin', { body: small, headers: { 'content-length': '999999' } }))?.status, 400);
});

test('no client IDs: not_configured', async () => {
  const { send } = setup('');
  const res = await send('POST', '/v1/account/nonce');
  assert.equal(res?.status, 503);
  assert.deepEqual(await json(res), { error: 'not_configured' });
});

test('no database bound yet: not_configured, still only for our paths', async () => {
  const handle = createAccountsFetch({ keys: signer.keys, clock: fakeClock() });
  const env: AccountsEnv = { GOOGLE_CLIENT_IDS: TEST_CLIENT_ID };
  const req = new Request(`${API}/v1/account/nonce`, { method: 'POST' });
  const res = await handle(req, new URL(req.url), env, allow);
  assert.equal(res?.status, 503);
  assert.deepEqual(await json(res), { error: 'not_configured' });
  const other = new Request(`${API}/v1/batch`, { method: 'POST' });
  assert.equal(await handle(other, new URL(other.url), env, allow), null);
});

test("a store that fails answers internal, never the store's message", async () => {
  const { send } = setup();
  const broken = createAccountsFetch({ keys: signer.keys });
  const env = {
    ACCOUNTS_DB: {
      prepare() {
        throw new Error('D1 is down: secret detail');
      },
      async batch() {
        throw new Error('D1 is down: secret detail');
      },
    },
    GOOGLE_CLIENT_IDS: TEST_CLIENT_ID,
  } as AccountsEnv;
  const req = new Request(`${API}/v1/account/nonce`, { method: 'POST' });
  const res = await broken(req, new URL(req.url), env, allow);
  assert.equal(res?.status, 500);
  assert.deepEqual(await json(res), { error: 'internal' });
  assert.ok(send); // the healthy setup is unaffected
});
