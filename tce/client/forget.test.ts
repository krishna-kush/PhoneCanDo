// forget(): delete by device proof, the clean local state after it, failed
// and foreign answers, and waiting for what is on the wire.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LIMITS } from '../core/schema/limits.ts';
import { assertServerAccepts, OK_BATCH, setup, stored, tick, until } from './harness.ts';
import { STORAGE_KEYS } from './types.ts';

describe('forget', () => {
  it('deletes by device proof, then clears local data, turns off and rotates the id', async () => {
    const { client, net, storage } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open');
    const oldId = client.installId();
    net.reply({ status: 200, body: { deleted: { devices: 1, events: 3, bogus: 'x' } } });
    const r = await client.forget();
    assert.ok(r.ok);
    assert.deepEqual(r.value, { deleted: { devices: 1, events: 3 } });
    assert.equal(net.sent[0]!.path, '/v1/forget');
    // No install id: the delete covers every install of this phone.
    assert.deepEqual(net.sent[0]!.json, { schema: 1, deviceId: 'a'.repeat(64), deviceProof: '7'.repeat(64) });
    assertServerAccepts(net);
    assert.equal(client.isEnabled(), false);
    assert.equal(storage.data.get(STORAGE_KEYS.enabled), '0');
    assert.notEqual(client.installId(), oldId);
    assert.equal(storage.data.get(STORAGE_KEYS.installId), client.installId());
    assert.equal(stored(storage), null);
    assert.equal(await client.flush(), null);
    assert.equal(net.sent.length, 1);
  });

  it("returns the server's not_found as not_found, and still ends clean", async () => {
    const { client, net, storage } = setup();
    await client.init();
    client.startSession();
    client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
    const oldId = client.installId();
    net.reply({ status: 404, body: { error: { code: 'not_found', message: 'no data for this device' } } });
    const r = await client.forget();
    assert.ok(!r.ok && r.error.code === 'not_found');
    assert.equal(client.isEnabled(), false);
    assert.equal(storage.data.get(STORAGE_KEYS.enabled), '0');
    assert.notEqual(client.installId(), oldId);
    await tick();
    assert.equal(stored(storage), null);
  });

  it('changes nothing when the server fails or the route is missing', async () => {
    for (const reply of [
      { status: 500, body: { error: { code: 'internal', message: 'x' } } },
      { status: 404, body: '<html>' },
      { status: 403, body: { error: { code: 'forbidden', message: 'rate' } } },
      { fail: 'offline' },
    ]) {
      const { client, net, storage } = setup();
      await client.init();
      client.startSession();
      client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
      const id = client.installId();
      net.reply(reply);
      const r = await client.forget();
      assert.equal(r.ok, false, JSON.stringify(reply));
      assert.notEqual(!r.ok && r.error.code, 'not_found', JSON.stringify(reply));
      assert.equal(client.isEnabled(), true);
      assert.equal(client.installId(), id);
      await tick();
      assert.equal(stored(storage)!.errors.length, 1);
      // Sending works again afterwards.
      net.reply(OK_BATCH);
      assert.ok((await client.flush())?.ok);
    }
  });

  it('stops sending and waits for the batch on the wire before deleting', async () => {
    const { client, net } = setup({ queueCap: 2000 });
    await client.init();
    client.startSession();
    for (let i = 0; i < 2 * LIMITS.eventsPerBatch + 10; i++) client.track('chat.open'); // three batches
    let release!: () => void;
    net.gate = new Promise<void>((r) => (release = r));
    const flushing = client.flush();
    await until(() => net.sent.length === 1);
    const forgetting = client.forget();
    for (let i = 0; i < 20; i++) await tick();
    // Nothing new starts while forget runs, and forget has not posted yet.
    assert.equal(await client.flush(), null);
    assert.equal(net.sent.length, 1);
    release();
    assert.equal(await flushing, null); // stopped after the batch already on the wire
    const r = await forgetting;
    assert.ok(r.ok);
    assert.deepEqual(net.sent.map((x) => x.path), ['/v1/batch', '/v1/forget']);
  });

  it('waits for a report on the wire and refuses a new one', async () => {
    const { client, net } = setup();
    await client.init();
    client.startSession();
    let release!: () => void;
    net.gate = new Promise<void>((r) => (release = r));
    const reporting = client.report({ note: 'n' });
    await until(() => net.sent.length === 1);
    const forgetting = client.forget();
    const late = await client.report({ note: 'late' });
    assert.ok(!late.ok && late.error.code === 'forbidden');
    for (let i = 0; i < 20; i++) await tick();
    assert.equal(net.sent.length, 1); // forget has not posted while the report is on the wire
    release();
    await reporting;
    await forgetting;
    assert.deepEqual(net.sent.map((x) => x.path), ['/v1/report', '/v1/forget']);
  });
});

describe('forget and foreign answers', () => {
  it('changes nothing when forget gets a 2xx that is not a forget response', async () => {
    for (const reply of [
      { status: 200, body: '<html>portal</html>' },
      { status: 200, body: {} },
      { status: 200, body: { deleted: [1, 2] } },
      { status: 204 },
    ]) {
      const what = JSON.stringify(reply);
      const { client, net, storage } = setup();
      await client.init();
      client.startSession();
      client.error({ kind: 'js', className: 'E', message: 'm', frames: [] });
      const id = client.installId();
      net.reply(reply);
      const r = await client.forget();
      assert.ok(!r.ok && r.error.code === 'unavailable', what);
      assert.equal(client.isEnabled(), true, what);
      assert.equal(client.installId(), id, what);
      assert.ok(await client.persist());
      assert.equal(stored(storage)!.errors.length, 1, what);
      // The server's real answer then ends it as usual.
      const done = await client.forget();
      assert.ok(done.ok, what);
      assert.equal(client.isEnabled(), false, what);
    }
  });
});
