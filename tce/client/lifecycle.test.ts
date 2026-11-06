// On/off, the tester flag and a new install id, including what happens to
// a flush already on the wire.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../core/schema/limits.ts';
import { batches, setup, sleep, stored, tick, until } from './harness.ts';
import { PERSIST_DEBOUNCE_MS } from './persistence.ts';
import { STORAGE_KEYS } from './types.ts';

describe('on/off, tester and install id', () => {
  it('off clears the queue, sends nothing and ignores new items; on resumes', async () => {
    const { client, net, storage } = setup();
    await client.init();
    const before = client.startSession();
    client.track('chat.open');
    client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
    await tick();
    assert.ok(stored(storage));

    await client.setEnabled(false);
    assert.equal(client.isEnabled(), false);
    assert.equal(storage.data.get(STORAGE_KEYS.enabled), '0');
    assert.equal(stored(storage), null);
    client.track('terminal.open');
    assert.equal(await client.flush(), null);
    assert.equal(net.sent.length, 0);

    await client.setEnabled(true);
    assert.equal(storage.data.get(STORAGE_KEYS.enabled), '1');
    await client.flush();
    const b = batches(net)[0]!;
    assert.equal(b.events.length, 0);
    assert.equal(b.errors.length, 0);
    assert.equal(b.sessions.length, 1); // a fresh session, nothing from before or during off
    assert.notEqual(b.sessions[0]!.sessionId, before);
  });

  it('sends the tester flag in the device row', async () => {
    const { client, net, storage } = setup();
    await client.init();
    client.startSession();
    await client.flush();
    await client.setTester(true);
    assert.equal(storage.data.get(STORAGE_KEYS.tester), '1');
    assert.equal(client.isTester(), true);
    await client.flush();
    assert.equal(batches(net)[1]!.device.tester, true);
  });

  it('reset install id: new id in the next batch, nothing from before', async () => {
    const { client, net, storage } = setup();
    await client.init();
    const oldId = client.installId();
    const oldSession = client.startSession();
    client.track('chat.open');
    const newId = await client.resetInstallId();
    assert.notEqual(newId, oldId);
    assert.equal(client.installId(), newId);
    assert.equal(storage.data.get(STORAGE_KEYS.installId), newId);
    client.track('terminal.open');
    await client.flush();
    const b = batches(net)[0]!;
    assert.equal(b.identity.installId, newId);
    assert.deepEqual(b.events.map((e) => e.name), ['terminal.open']);
    assert.ok(b.sessions.every((s) => s.sessionId !== oldSession));
  });
});

describe('off means off', () => {
  it('does not touch the session or storage while off', async () => {
    const { client, storage, clock } = setup();
    await client.init();
    client.startSession();
    await client.setEnabled(false);
    const writes = storage.writes;
    client.updateSession({ bootMs: 5 });
    client.updateSession({ endedAt: clock.now() });
    client.track('chat.open');
    client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
    await sleep(PERSIST_DEBOUNCE_MS + 50);
    assert.equal(storage.writes, writes);
    assert.equal(stored(storage), null);
  });

  it('drops session updates, events and errors while off; on starts a fresh session', async () => {
    const { client, net } = setup();
    await client.init();
    const first = client.startSession();
    await client.setEnabled(false);
    client.updateSession({ bootMs: 999, a11yOn: true, counters: { 'engine.starts': 7 } });
    client.track('chat.open');
    client.error({ kind: 'js', className: 'E', message: 'during off', frames: [] });
    await client.setEnabled(true);
    client.updateSession({ engineOk: true });
    await client.flush();
    const b = batches(net)[0]!;
    assert.equal(b.sessions.length, 1);
    const s = b.sessions[0]!;
    assert.notEqual(s.sessionId, first);
    assert.equal(s.bootMs, undefined);
    assert.equal(s.a11yOn, undefined);
    assert.equal(s.counters, undefined);
    assert.equal(s.engineOk, true);
    assert.equal(b.events.length, 0);
    assert.equal(b.errors.length, 0);
  });
});

describe('in-flight batches', () => {
  async function threeBatches() {
    const t = setup({ queueCap: 2000 });
    await t.client.init();
    t.client.startSession();
    for (let i = 0; i < 2 * LIMITS.eventsPerBatch + 10; i++) t.client.track('chat.open');
    let release!: () => void;
    t.net.gate = new Promise<void>((r) => (release = r));
    const flushing = t.client.flush();
    await until(() => t.net.sent.length === 1);
    return { ...t, flushing, release: () => release() };
  }

  it('turning off mid-flush sends no further batch', async () => {
    const { client, net, flushing, release } = await threeBatches();
    await client.setEnabled(false);
    release();
    assert.equal(await flushing, null);
    assert.equal(net.sent.length, 1);
  });

  it('a new install id waits for the batch on the wire and sends nothing planned for the old id', async () => {
    const { client, net, flushing, release } = await threeBatches();
    const oldId = client.installId();
    let resetDone = false;
    const resetting = client.resetInstallId().then((id) => {
      resetDone = true;
      return id;
    });
    await tick();
    await tick();
    assert.equal(resetDone, false); // waits for the request already on the wire
    assert.equal(client.installId(), oldId);
    assert.equal(await client.flush(), null); // nothing starts meanwhile
    release();
    assert.equal(await flushing, null);
    const newId = await resetting;
    assert.equal(net.sent.length, 1);
    assert.equal(batches(net)[0]!.identity.installId, oldId);
    client.track('terminal.open');
    net.gate = null;
    await client.flush();
    const b = batches(net)[1]!;
    assert.equal(b.identity.installId, newId);
    assert.deepEqual(b.events.map((e) => e.name), ['terminal.open']);
  });
});
