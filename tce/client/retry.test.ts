// Retry rules: backoff and Retry-After, what is kept and retried, and what
// is dropped (only the server's own final rejection).

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../core/schema/limits.ts';
import { batches, OK_BATCH, setup, stored, until } from './harness.ts';
import { BACKOFF_BASE_MS, backoffDelay, RETRY_AFTER_MAX_MS, retryDelay } from './retry.ts';

describe('retry rules', () => {
  it('backs off 30 s doubling to 1 h on retryable failures and resets on success', async () => {
    assert.deepEqual(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 30].map(backoffDelay),
      [30, 60, 120, 240, 480, 960, 1920, 3600, 3600, 3600].map((s) => s * 1000),
    );
    const { client, net, clock } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open');

    net.reply({ fail: 'offline' });
    const r1 = await client.flush();
    assert.ok(r1 && !r1.ok && r1.error.code === 'unavailable');
    assert.equal(net.sent.length, 1);

    const r2 = await client.flush(); // still backing off: no request
    assert.ok(r2 && !r2.ok);
    assert.equal(net.sent.length, 1);

    clock.advance(30_000);
    net.reply({ status: 503, body: { error: { code: 'unavailable', message: 'store down' } } });
    await client.flush();
    assert.equal(net.sent.length, 2);

    clock.advance(59_999);
    await client.flush();
    assert.equal(net.sent.length, 2);
    clock.advance(1);
    net.reply({ status: 500, body: 'oops' });
    await client.flush();
    assert.equal(net.sent.length, 3);

    clock.advance(120_000);
    net.reply(OK_BATCH);
    const ok = await client.flush();
    assert.ok(ok?.ok);
    assert.equal(net.sent.length, 4);
    assert.equal(batches(net)[3]!.events.length, 1); // kept through every failure

    client.track('terminal.open');
    net.reply(OK_BATCH);
    await client.flush(); // backoff cleared: goes out at once
    assert.equal(net.sent.length, 5);
  });

  it('drops a batch the server rejects for good, so it cannot loop', async () => {
    const { client, net, log } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open');
    net.reply({ status: 400, body: { error: { code: 'bad_request', message: 'bad shape', field: 'events.0' } } });
    const r = await client.flush();
    assert.ok(r && !r.ok && r.error.code === 'bad_request' && r.error.field === 'events.0');
    assert.ok(log.has('error', 'rejected'));
    assert.equal(await client.flush(), null);
    assert.equal(net.sent.length, 1);
  });

  it('keeps and retries a batch answered by something other than the server', async () => {
    for (const reply of [
      { status: 403, body: '<html>challenge</html>' },
      { status: 404, body: '<html>not here</html>' },
      { status: 400, body: 'Bad Request' },
      { status: 302, body: '' },
      { status: 413, body: '<html>too big</html>' },
      { status: 409, body: { error: { code: 'unavailable', message: 'busy' } } },
    ]) {
      const { client, net, clock } = setup();
      await client.init();
      client.startSession();
      client.track('chat.open');
      net.reply(reply);
      const r = await client.flush();
      assert.ok(r && !r.ok && r.error.code === 'unavailable', JSON.stringify(reply));
      clock.advance(BACKOFF_BASE_MS);
      net.reply(OK_BATCH);
      assert.ok((await client.flush())?.ok, JSON.stringify(reply));
      assert.equal(batches(net)[1]!.events.length, 1, JSON.stringify(reply));
    }
  });

  it("drops a batch only on the server's own final 4xx", async () => {
    for (const reply of [
      { status: 400, body: { error: { code: 'bad_request', message: 'bad' } } },
      { status: 413, body: { error: { code: 'too_large', message: 'big' } } },
      { status: 403, body: { error: { code: 'forbidden', message: 'verifier mismatch' } } },
    ]) {
      const { client, net } = setup();
      await client.init();
      client.startSession();
      client.track('chat.open');
      net.reply(reply);
      const r = await client.flush();
      assert.ok(r && !r.ok, JSON.stringify(reply));
      assert.equal(await client.flush(), null, JSON.stringify(reply)); // nothing left
    }
  });

  it('honours Retry-After as the minimum wait', async () => {
    const { client, net, clock } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open');
    net.reply({ status: 429, body: { error: { code: 'unavailable', message: 'slow down' } }, retryAfter: '120' });
    await client.flush();
    clock.advance(BACKOFF_BASE_MS);
    await client.flush(); // backoff alone would allow this one
    assert.equal(net.sent.length, 1);
    clock.advance(120_000 - BACKOFF_BASE_MS);
    net.reply(OK_BATCH);
    assert.ok((await client.flush())?.ok);
    assert.equal(net.sent.length, 2);
  });

  it('retries a batch answered 405, even with the router ErrorBody, and keeps it whole', async () => {
    for (const reply of [
      // A POST that followed a 301/302 arrives as a GET; the router refuses it.
      { status: 405, body: { error: { code: 'bad_request', message: 'method GET not allowed; use POST' } } },
      { status: 405, body: '' },
    ]) {
      const what = JSON.stringify(reply);
      const { client, net, clock, storage } = setup();
      await client.init();
      client.startSession();
      client.track('chat.open');
      client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
      net.reply(reply);
      const r = await client.flush();
      assert.ok(r && !r.ok && r.error.code === 'unavailable', what);
      assert.ok(await client.persist());
      assert.equal(stored(storage)!.events.length, 1, what);
      assert.equal(stored(storage)!.errors.length, 1, what);
      const waiting = await client.flush(); // backing off: no request
      assert.ok(waiting && !waiting.ok, what);
      assert.equal(net.sent.length, 1, what);
      clock.advance(BACKOFF_BASE_MS);
      assert.ok((await client.flush())?.ok, what);
      const [first, second] = batches(net);
      assert.deepEqual(second!.events, first!.events, what);
      assert.deepEqual(second!.errors, first!.errors, what);
      assert.equal(await client.flush(), null, what); // delivered now
    }
  });

  it('retries a 2xx whose body is not a batch response, and removes nothing', async () => {
    for (const reply of [
      { status: 200, body: '<html>Welcome to the airport wifi</html>' },
      { status: 200, body: {} },
      { status: 204 },
      { status: 200, body: { ok: true } },
      { status: 200, body: [OK_BATCH.body] },
      { status: 200, body: { serverTime: 1, accepted: { sessions: 1, events: 1 }, droppedEvents: 0 } },
      { status: 200, body: { serverTime: '1', accepted: { sessions: 1, events: 1, errors: 0 }, droppedEvents: 0 } },
      { status: 202, body: { serverTime: 1, accepted: { sessions: 1, events: 1, errors: 0 } } },
    ]) {
      const what = JSON.stringify(reply);
      const { client, net, clock, storage, log } = setup();
      await client.init();
      const sid = client.startSession();
      client.track('chat.open');
      client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
      net.reply(reply);
      const r = await client.flush();
      assert.ok(r && !r.ok && r.error.code === 'unavailable', what);
      assert.ok(log.has('warn', 'will retry'), what);
      assert.ok(await client.persist());
      const q = stored(storage)! as { events: unknown[]; errors: unknown[]; sessions: Array<{ dirty: boolean; wire: { sessionId: string } }> };
      assert.equal(q.events.length, 1, what);
      assert.equal(q.errors.length, 1, what);
      assert.equal(q.sessions.find((s) => s.wire.sessionId === sid)!.dirty, true, what);
      const waiting = await client.flush(); // backing off like any retryable failure
      assert.ok(waiting && !waiting.ok, what);
      assert.equal(net.sent.length, 1, what);
      clock.advance(BACKOFF_BASE_MS);
      assert.ok((await client.flush())?.ok, what);
      const [first, second] = batches(net);
      assert.deepEqual(second!.events, first!.events, what);
      assert.deepEqual(second!.errors, first!.errors, what);
      assert.deepEqual(second!.sessions.map((s) => s.sessionId), [sid], what);
      assert.equal(await client.flush(), null, what);
    }
  });

  it('a genuine 2xx removes exactly the items its batch carried', async () => {
    const { client, net, storage, clock } = setup({ queueCap: 2000 });
    await client.init();
    client.startSession();
    const n = LIMITS.eventsPerBatch;
    for (let i = 0; i < n + 5; i++) client.track('chat.open'); // two batches: n events, then 5
    let release!: () => void;
    net.gate = new Promise<void>((r) => (release = r));
    net.reply(OK_BATCH, { status: 200, body: '<html>portal</html>' });
    const p = client.flush();
    await until(() => net.sent.length === 1);
    client.track('terminal.open'); // queued while the first batch is on the wire
    release();
    const r = await p;
    assert.ok(r && !r.ok && r.error.code === 'unavailable');
    const [first, second] = batches(net);
    assert.equal(first!.events.length, n);
    assert.equal(second!.events.length, 5);
    // The first batch is gone; the second batch and the late event are not.
    assert.ok(await client.persist());
    const left = (stored(storage)!.events as Array<{ seq: number }>).map((e) => e.seq);
    assert.deepEqual(left, [...second!.events.map((e) => e.seq), n + 6]);
    net.gate = null;
    clock.advance(BACKOFF_BASE_MS);
    assert.ok((await client.flush())?.ok);
    assert.deepEqual(batches(net)[2]!.events.map((e) => e.seq), left);
    assert.equal(await client.flush(), null);
  });

  it('keeps the backoff when Retry-After is shorter, and caps a huge one', () => {
    assert.equal(retryDelay(3, 1000), backoffDelay(3));
    assert.equal(retryDelay(1, null), BACKOFF_BASE_MS);
    assert.equal(retryDelay(1, 10 * 24 * 3600_000), RETRY_AFTER_MAX_MS);
  });
});
