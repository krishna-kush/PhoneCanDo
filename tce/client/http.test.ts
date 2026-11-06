import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeNet } from './fakes.ts';
import { postJson } from './http.ts';

const URL_ = 'https://t.example/v1/batch';
const ROUTER_405 = { error: { code: 'bad_request', message: 'method GET not allowed; use POST' } };

async function classify(reply: Parameters<FakeNet['reply']>[0]) {
  const net = new FakeNet().reply(reply);
  return postJson(net, URL_, '{}', 1000, () => 1_750_000_000_000);
}

describe('postJson classification', () => {
  it('retries a 405 even with the router ErrorBody (a POST that a redirect turned into a GET)', async () => {
    const out = await classify({ status: 405, body: ROUTER_405, retryAfter: '60' });
    assert.equal(out.ok, false);
    if (out.ok) return;
    assert.equal(out.retryable, true);
    assert.equal(out.status, 405);
    assert.equal(out.error.code, 'unavailable');
    assert.equal(out.error.message, 'HTTP 405: method GET not allowed; use POST');
    assert.equal(out.fromBody, false);
    assert.equal(out.retryAfterMs, 60_000);
  });

  it('retries a 405 without a body too', async () => {
    const out = await classify({ status: 405, body: '<html>Method Not Allowed</html>' });
    assert.ok(!out.ok && out.retryable && out.error.code === 'unavailable' && out.error.message === 'HTTP 405');
  });

  it("still treats the server's own final 4xx as final", async () => {
    for (const [status, code] of [
      [400, 'bad_request'],
      [403, 'forbidden'],
      [404, 'not_found'],
      [413, 'too_large'],
    ] as const) {
      const out = await classify({ status, body: { error: { code, message: 'no' } } });
      assert.ok(!out.ok && !out.retryable && out.fromBody && out.error.code === code, `${status}`);
    }
  });

  it('hands a 2xx body to the caller to check', async () => {
    const out = await classify({ status: 200, body: '<html>portal</html>' });
    assert.ok(out.ok);
    assert.equal(out.json, undefined);
  });
});
