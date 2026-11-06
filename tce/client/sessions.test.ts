// Sessions: merged updates, the build stamp, no engine output, the write
// on endedAt, and the previous process's session the adapter adds to.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeStorage } from './fakes.ts';
import { assertServerAccepts, batches, crashId, OK_BATCH, setup, stored, tick } from './harness.ts';
import { STORAGE_KEYS } from './types.ts';

describe('session facts', () => {
  it('merges session updates and resends a session that changed', async () => {
    const { client, net } = setup();
    await client.init();
    const sid = client.startSession();
    client.updateSession({ bootMs: 1200, counters: { 'engine.starts': 1, 'tool.mobile_click': 2 } });
    client.updateSession({ engineOk: true, counters: { 'tool.mobile_click': 5 } });
    net.reply(OK_BATCH, OK_BATCH);
    await client.flush();
    assert.deepEqual(batches(net)[0]!.sessions[0], {
      sessionId: sid,
      startedAt: batches(net)[0]!.sessions[0]!.startedAt,
      version: '0.1.3',
      versionCode: 13,
      channel: 'full',
      bootMs: 1200,
      engineOk: true,
      counters: { 'engine.starts': 1, 'tool.mobile_click': 5 },
    });
    assert.equal(await client.flush(), null); // clean now
    client.updateSession({ a11yOn: true });
    await client.flush();
    const second = batches(net)[1]!;
    assert.equal(second.events.length, 0);
    assert.equal(second.sessions[0]!.a11yOn, true);
    assert.equal(second.sessions[0]!.bootMs, 1200);
  });

  it('stamps each session with the build that started it', async () => {
    const { client, net, env } = setup();
    await client.init();
    const sid = client.startSession();
    client.track('chat.open');
    // The app updates before this session is flushed.
    env.appWire = { version: '0.2.0', versionCode: 20, channel: 'lite' };
    await client.flush();
    const b = batches(net)[0]!;
    assert.deepEqual(b.app, { version: '0.2.0', versionCode: 20, channel: 'lite' });
    const s = b.sessions.find((x) => x.sessionId === sid)!;
    assert.deepEqual([s.version, s.versionCode, s.channel], ['0.1.3', 13, 'full']);
    assertServerAccepts(net);
  });

  it('never sends engine output in a session', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    client.updateSession({ engineExitCode: 1, engineStderrTail: 'prompt: my diary' });
    await client.flush();
    const s = batches(net)[0]!.sessions[0]!;
    assert.equal(s.engineExitCode, 1);
    assert.equal('engineStderrTail' in s, false);
    assert.ok(!net.sent[0]!.body.includes('diary'));
  });

  it('writes the queue at once when the session gets endedAt', async () => {
    const { client, storage, clock } = setup();
    await client.init();
    client.startSession();
    client.updateSession({ counters: { 'engine.starts': 1 } });
    client.updateSession({ endedAt: clock.now() });
    await tick();
    const q = stored(storage)!;
    assert.equal(q.sessions.length, 1);
    assert.deepEqual((q.sessions[0] as { wire: { counters: unknown } }).wire.counters, { 'engine.starts': 1 });
  });
});

describe('previous session', () => {
  it("finds the previous process's session while the queue holds it, and adds to it", async () => {
    const a = setup();
    await a.client.init();
    a.client.startSession();
    const prev = a.client.startSession(); // the last one this process opened
    a.client.updateSession({ bootMs: 900, engineOk: true, counters: { 'engine.starts': 1, 'tool.notify': 2 } });
    assert.ok(await a.client.persist()); // the process dies with it unsent

    const b = setup({ storage: a.storage });
    const next = b.client.startSession(); // before init, as the app does
    assert.equal(b.client.previousSession(), null); // the queue is not loaded yet
    await b.client.init();
    const p = b.client.previousSession();
    assert.equal(p?.sessionId, prev);
    assert.deepEqual(p?.counters, { 'engine.starts': 1, 'tool.notify': 2 });
    p!.counters!['engine.starts'] = 99; // a copy
    assert.equal(b.client.previousSession()!.counters!['engine.starts'], 1);

    assert.equal(b.client.updatePreviousSession({ engineOk: false, counters: { 'engine.died': 1, 'tool.notify': 3 } }), true);
    await b.client.flush();
    const sent = batches(b.net)[0]!.sessions;
    const old = sent.find((s) => s.sessionId === prev)!;
    assert.deepEqual(old.counters, { 'engine.starts': 1, 'tool.notify': 3, 'engine.died': 1 });
    assert.equal(old.engineOk, false);
    assert.equal(old.bootMs, 900);
    const fresh = sent.find((s) => s.sessionId === next)!;
    assert.equal(fresh.counters, undefined);
    assert.equal(fresh.engineOk, undefined);
    assertServerAccepts(b.net);
    // Delivered, so the queue no longer holds it: nothing more can be added.
    assert.equal(b.client.previousSession(), null);
    assert.equal(b.client.updatePreviousSession({ counters: { 'engine.died': 2 } }), false);
  });

  it('keeps the stored pointer when a process writes before opening a session', async () => {
    const a = setup();
    await a.client.init();
    const prev = a.client.startSession();
    a.client.track('chat.open');
    assert.ok(await a.client.persist());
    const b = setup({ storage: a.storage });
    await b.client.init();
    b.client.error({ kind: 'native', errorId: crashId(), sessionId: null, className: 'E', message: 'm', frames: [] });
    assert.ok(await b.client.persist());
    const c = setup({ storage: a.storage });
    await c.client.init();
    assert.equal(c.client.previousSession()?.sessionId, prev);
  });

  it('has no previous session once it was delivered, without a stored pointer, or while off', async () => {
    const a = setup();
    await a.client.init();
    a.client.startSession();
    a.client.track('chat.open');
    assert.ok((await a.client.flush())?.ok);
    assert.ok(await a.client.persist());
    const b = setup({ storage: a.storage });
    b.client.startSession();
    await b.client.init();
    assert.equal(b.client.previousSession(), null);
    assert.equal(b.client.updatePreviousSession({ counters: { 'engine.starts': 1 } }), false);

    // A queue written before the pointer existed.
    const old = new FakeStorage();
    const session = { wire: { sessionId: '00000000-0000-4000-8000-0000000000b1', startedAt: 1_750_000_000_000 }, dirty: true, nextSeq: 1 };
    old.data.set(STORAGE_KEYS.queue, JSON.stringify({ v: 1, sessions: [session], events: [], errors: [] }));
    const c = setup({ storage: old });
    await c.client.init();
    assert.equal(c.client.previousSession(), null);

    // Stored choice off: the queue is dropped at init.
    const d0 = setup();
    await d0.client.init();
    d0.client.startSession();
    assert.ok(await d0.client.persist());
    d0.storage.data.set(STORAGE_KEYS.enabled, '0');
    const d = setup({ storage: d0.storage });
    await d.client.init();
    assert.equal(d.client.previousSession(), null);
    assert.equal(d.client.updatePreviousSession({ counters: { 'engine.starts': 1 } }), false);
  });
});
