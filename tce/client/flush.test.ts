// flush(): what a batch carries, how the queue is split, one flush at a
// time, the queue cap, and requests the server's parsers accept.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../core/schema/limits.ts';
import { DEFAULT_TIMEOUT_MS } from './context.ts';
import { assertServerAccepts, batches, crashId, setup, until, UUID } from './harness.ts';
import { utf8Length } from './sanitize.ts';

describe('flush', () => {
  it('flushes identity, device, app, session and events, then forgets them', async () => {
    const { client, net } = setup();
    await client.init();
    const sid = client.startSession();
    client.track('chat.open', { from: 'home' });
    client.track('terminal.open');
    net.reply({ status: 200, body: { serverTime: 77, accepted: { sessions: 1, events: 2, errors: 0 }, droppedEvents: 0 } });

    const r = await client.flush();
    assert.ok(r?.ok);
    assert.deepEqual(r.value, { serverTime: 77, accepted: { sessions: 1, events: 2, errors: 0 }, droppedEvents: 0 });
    assert.equal(net.sent[0]!.url, 'https://t.example/v1/batch');
    assert.equal(net.sent[0]!.timeoutMs, DEFAULT_TIMEOUT_MS);
    const b = batches(net)[0]!;
    assert.equal(b.schema, 1);
    assert.match(b.batchId, UUID);
    assert.deepEqual(b.identity, {
      installId: client.installId(),
      deviceId: 'a'.repeat(64),
      hwHash: 'b'.repeat(64),
      deviceVerifier: '9'.repeat(64),
    });
    assert.equal(b.device.tester, false);
    assert.equal(b.device.model, 'Pixel 9');
    assert.deepEqual(b.app, { version: '0.1.3', versionCode: 13, channel: 'full' });
    assert.deepEqual(b.sessions.map((s) => s.sessionId), [sid]);
    assert.deepEqual(b.events.map((e) => [e.name, e.seq, e.props]), [
      ['chat.open', 1, { from: 'home' }],
      ['terminal.open', 2, undefined],
    ]);

    assert.equal(await client.flush(), null);
    assert.equal(net.sent.length, 1);
  });

  it('splits a long queue by the events-per-batch cap', async () => {
    const { client, net } = setup({ queueCap: 2000 });
    await client.init();
    client.startSession();
    const n = LIMITS.eventsPerBatch;
    for (let i = 0; i < 2 * n + 50; i++) client.track('chat.open');
    const r = await client.flush();
    assert.ok(r?.ok);
    assert.deepEqual(batches(net).map((b) => b.events.length), [n, n, 50]);
    assert.deepEqual(
      batches(net).flatMap((b) => b.events.map((e) => e.seq)),
      Array.from({ length: 2 * n + 50 }, (_, i) => i + 1),
    );
    assert.equal(await client.flush(), null);
  });

  it('splits by body size so no request exceeds the cap', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    for (let i = 0; i < 400; i++) client.track('chat.open', { a: 'x'.repeat(200), b: 'y'.repeat(200) });
    await client.flush();
    assert.ok(net.sent.length > 1);
    for (const r of net.sent) assert.ok(utf8Length(r.body) <= LIMITS.batchBodyBytes, `body ${utf8Length(r.body)}`);
    assert.equal(batches(net).reduce((n, b) => n + b.events.length, 0), 400);
  });

  it('runs one flush at a time', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open');
    let release!: () => void;
    net.gate = new Promise<void>((r) => (release = r));
    const p1 = client.flush();
    const p2 = client.flush();
    assert.equal(p1, p2);
    await until(() => net.sent.length === 1);
    release();
    await p1;
    assert.equal(net.sent.length, 1);
  });

  it('keeps what was queued during a flush and resends a session changed in flight', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open');
    let release!: () => void;
    net.gate = new Promise<void>((r) => (release = r));
    const p = client.flush();
    await until(() => net.sent.length === 1);
    client.track('terminal.open');
    client.updateSession({ bootMs: 5 });
    release();
    await p;
    net.gate = null;
    await client.flush();
    const second = batches(net)[1]!;
    assert.deepEqual(second.events.map((e) => e.name), ['terminal.open']);
    assert.equal(second.sessions[0]!.bootMs, 5);
  });

  it('caps the queue by dropping the oldest events first', async () => {
    const { client, net, log } = setup({ queueCap: 10 });
    await client.init();
    client.startSession();
    for (let i = 0; i < 12; i++) client.track('chat.open');
    await client.flush();
    assert.deepEqual(batches(net)[0]!.events.map((e) => e.seq), [4, 5, 6, 7, 8, 9, 10, 11, 12]);
    assert.ok(log.has('warn', 'queue full'));
  });
});

describe('server rules', () => {
  it('sends only what the server parsers accept', async () => {
    const { client, net, env } = setup();
    env.drmId = 'e'.repeat(64);
    env.deviceWire = { ...env.deviceWire, sdkInt: 0, ramGb: 7.7, installSource: 'com.android.vending' };
    await client.init();
    await client.setTester(true);
    client.startSession();
    client.updateSession({
      bootMs: 1500.7,
      engineOk: false,
      engineExitCode: -9,
      engineStderrTail: 'killed /data/user/0/x',
      lowMemoryTrims: 2,
      batteryOptIgnored: true,
      fgServiceOk: true,
      a11yOn: false,
      endedAt: 1_750_000_100_000,
      counters: { 'tool.pce_act': 3, 'session.create': 1, 'bad key!': 2 },
    });
    client.track('chat.open', { from: 'home', n: 2.5, ok: true });
    client.track('a11y.step.2.reached');
    client.error({ kind: 'js', className: 'TypeError', message: 'x', frames: ['at a (index.bundle:1:2)'], ts: 1_750_000_000_123.6 });
    client.error({ kind: 'native', errorId: crashId(), sessionId: null, className: 'E', message: 'm', frames: [], version: '0.1.2' });
    client.error({ kind: 'engine', sessionId: 'not-a-session', className: 'exit 137', message: 'oom', frames: [] });
    await client.flush();
    await client.report({ note: 'n', logTail: 'l' });
    await client.forget();
    assert.equal(net.sent.length, 3);
    assertServerAccepts(net);
    const b = batches(net)[0]!;
    assert.deepEqual(b.sessions[0]!.counters, { 'tool.pce_act': 3, 'session.create': 1, 'bad_key_': 2 });
    assert.equal(b.device.sdkInt, 1);
    assert.equal(b.errors.find((e) => e.kind === 'engine')!.sessionId, null);
  });

  it('holds the queue while the device clock is out of range, then drops what it mis-stamped', async () => {
    const { client, net, clock, log } = setup();
    await client.init();
    clock.t = 0; // a phone that booted without network time
    client.startSession();
    client.track('chat.open');
    const r = await client.flush();
    assert.ok(r && !r.ok && r.error.code === 'unavailable');
    assert.equal(net.sent.length, 0);
    assert.ok(log.has('warn', 'clock out of range'));

    clock.t = 1_750_000_000_000;
    client.track('terminal.open');
    const r2 = await client.flush();
    assert.ok(r2?.ok);
    const b = batches(net)[0]!;
    assert.deepEqual(b.events.map((e) => e.name), ['terminal.open']);
    assert.equal(b.sessions[0]!.startedAt, 1_750_000_000_000);
    assert.ok(log.has('warn', 'wrong clock'));
    assertServerAccepts(net);
  });
});
