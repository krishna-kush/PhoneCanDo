// init(): the on/off choice, the install id and the stored queue, and what
// becomes of items recorded before init finished.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FakeStorage } from './fakes.ts';
import { batches, setup, tick, UUID } from './harness.ts';
import { STORAGE_KEYS } from './types.ts';

describe('init', () => {
  it('is on by default and keeps one install id across restarts', async () => {
    const a = setup();
    await a.client.init();
    assert.equal(a.client.isEnabled(), true);
    const id = a.client.installId();
    assert.match(id!, UUID);
    assert.equal(a.storage.data.get(STORAGE_KEYS.installId), id);

    const b = setup({ storage: a.storage });
    assert.equal(b.client.installId(), null);
    await b.client.init();
    assert.equal(b.client.installId(), id);
  });

  it('replaces a malformed stored install id', async () => {
    const storage = new FakeStorage();
    storage.data.set(STORAGE_KEYS.installId, 'not-a-uuid');
    const { client } = setup({ storage });
    await client.init();
    assert.match(client.installId()!, UUID);
    assert.equal(storage.data.get(STORAGE_KEYS.installId), client.installId());
  });

  it('stays off for the run when the on/off setting cannot be read', async () => {
    const storage = new FakeStorage();
    storage.failReads = true;
    const { client, net, log } = setup({ storage });
    await client.init();
    assert.equal(client.isEnabled(), false);
    client.track('chat.open');
    assert.equal(await client.flush(), null);
    assert.equal(net.sent.length, 0);
    assert.ok(log.has('warn', 'off for this run'));
  });

  it('keeps items recorded before init, after the stored ones', async () => {
    const a = setup();
    await a.client.init();
    a.client.startSession();
    a.client.track('chat.open');
    a.client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
    await tick();

    const b = setup({ storage: a.storage });
    b.client.startSession();
    b.client.track('terminal.open');
    await b.client.init();
    await b.client.flush();
    assert.deepEqual(batches(b.net)[0]!.events.map((e) => e.name), ['chat.open', 'terminal.open']);
  });

  it('drops items recorded before init when the stored choice is off', async () => {
    const storage = new FakeStorage();
    storage.data.set(STORAGE_KEYS.enabled, '0');
    const { client, net } = setup({ storage });
    client.track('chat.open');
    await client.init();
    assert.equal(client.isEnabled(), false);
    assert.equal(await client.flush(), null);
    assert.equal(net.sent.length, 0);
  });

  it('resets a corrupted stored queue and logs it', async () => {
    const storage = new FakeStorage();
    storage.data.set(STORAGE_KEYS.queue, '{definitely not json');
    const { client, net, log } = setup({ storage });
    await client.init();
    assert.ok(log.has('warn', 'unreadable'));
    assert.equal(storage.data.has(STORAGE_KEYS.queue), false);
    client.track('chat.open');
    await client.flush();
    assert.equal(batches(net)[0]!.events.length, 1);
  });
});
