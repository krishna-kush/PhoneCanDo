// Queue writes: the debounce, errors written at once, storage failures and
// persist().

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { batches, setup, sleep, stored, tick } from './harness.ts';
import { PERSIST_DEBOUNCE_MS } from './persistence.ts';

describe('persistence', () => {
  it('writes the queue after a short debounce and a new client resends it', async () => {
    const a = setup();
    await a.client.init();
    const oldSession = a.client.startSession();
    a.client.track('chat.open');
    a.client.track('terminal.open');
    assert.equal(stored(a.storage), null);
    await sleep(PERSIST_DEBOUNCE_MS + 50);
    assert.equal(stored(a.storage)!.events.length, 2);

    const b = setup({ storage: a.storage });
    await b.client.init();
    const newSession = b.client.startSession();
    await b.client.flush();
    const req = batches(b.net)[0]!;
    assert.deepEqual(req.events.map((e) => [e.sessionId, e.name]), [
      [oldSession, 'chat.open'],
      [oldSession, 'terminal.open'],
    ]);
    assert.deepEqual(req.sessions.map((s) => s.sessionId).sort(), [oldSession, newSession].sort());
    await sleep(PERSIST_DEBOUNCE_MS + 50);
    assert.equal(stored(b.storage), null); // everything delivered
  });

  it('writes errors at once', async () => {
    const { client, storage } = setup();
    await client.init();
    client.startSession();
    client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
    await tick();
    assert.equal(stored(storage)!.errors.length, 1);
  });

  it('survives storage write failures', async () => {
    const { client, net, storage, log } = setup();
    await client.init();
    storage.failWrites = true;
    client.startSession();
    client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
    await tick();
    assert.ok(log.has('warn', 'could not persist'));
    await client.flush();
    assert.equal(batches(net)[0]!.errors.length, 1);
  });

  it('persist() resolves once the latest state is stored, and says when a write failed', async () => {
    const { client, storage } = setup();
    client.startSession();
    client.track('chat.open'); // before init: persist waits for it
    assert.equal(await client.persist(), true);
    assert.equal(stored(storage)!.events.length, 1);
    client.track('terminal.open'); // a debounced write is pending
    assert.equal(await client.persist(), true);
    assert.equal(stored(storage)!.events.length, 2); // without waiting out the debounce
    storage.failWrites = true;
    client.track('env.add');
    assert.equal(await client.persist(), false);
  });
});
