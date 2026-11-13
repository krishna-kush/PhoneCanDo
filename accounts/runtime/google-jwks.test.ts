import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GOOGLE_CERTS_URL, googleJwks, type FetchLike } from './google-jwks.ts';

const answer = (status: number, body: unknown, cacheControl: string | null): FetchLike => async (url) => {
  assert.equal(url, GOOGLE_CERTS_URL);
  return { ok: status === 200, status, headers: { get: (n) => (n === 'cache-control' ? cacheControl : null) }, json: async () => body };
};

test("reads Google's keys and max-age", async () => {
  const got = await googleJwks(answer(200, { keys: [{ kid: 'a' }] }, 'public, max-age=21600'))();
  assert.deepEqual(got, { keys: [{ kid: 'a' }], maxAgeS: 21600 });
});

test('a failed answer throws', async () => {
  await assert.rejects(googleJwks(answer(503, {}, null))(), /503/);
});

test('a body without keys gives undefined keys', async () => {
  assert.deepEqual(await googleJwks(answer(200, null, null))(), { keys: undefined, maxAgeS: null });
});
