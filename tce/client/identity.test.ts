// Platform identity: shape checks, the drm id, and the device proof that
// only forget() ever sends.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertServerAccepts, batches, OK_BATCH, setup } from './harness.ts';

describe('identity and the device proof', () => {
  it('sends nothing when the platform identity is malformed, and keeps the items', async () => {
    const { client, net, env } = setup();
    await client.init();
    client.startSession();
    client.track('chat.open');
    env.deviceId = 'xyz';
    const r = await client.flush();
    assert.ok(r && !r.ok && r.error.code === 'bad_request');
    assert.equal(net.sent.length, 0);
    env.deviceId = 'c'.repeat(64);
    net.reply(OK_BATCH);
    const r2 = await client.flush();
    assert.ok(r2?.ok);
    assert.equal(batches(net)[0]!.identity.deviceId, 'c'.repeat(64));
    assert.equal(batches(net)[0]!.events.length, 1);
  });

  it('passes a drm id through when the platform has one', async () => {
    const { client, net, env } = setup();
    env.drmId = 'D'.repeat(64);
    await client.init();
    client.track('chat.open');
    await client.flush();
    assert.equal(batches(net)[0]!.identity.drmId, 'd'.repeat(64));
  });

  it('sends the verifier in every batch and report, and the proof nowhere but forget', async () => {
    const { client, net, env, log } = setup();
    env.deviceProof = 'c0ffee'.repeat(10) + 'beef';
    await client.init();
    client.startSession();
    client.track('chat.open');
    await client.flush();
    await client.report({ note: 'n', logTail: 'l' });
    await client.forget();
    for (const r of net.sent) {
      const hasProof = r.body.includes(env.deviceProof);
      assert.equal(hasProof, r.path === '/api/forget', r.path);
      if (r.path !== '/api/forget') assert.equal(r.json.identity.deviceVerifier, '9'.repeat(64));
    }
    assertServerAccepts(net);
    assert.ok(log.lines.every((l) => !JSON.stringify(l).includes(env.deviceProof)));
  });

  it('refuses a malformed verifier or proof, or a proof that equals another id', async () => {
    for (const bad of [
      { deviceVerifier: 'xyz' },
      { deviceProof: '' },
      { deviceProof: 'a'.repeat(64) }, // same as deviceId
      { deviceProof: '9'.repeat(64) }, // same as the verifier
    ]) {
      const { client, net, env } = setup();
      Object.assign(env, bad);
      await client.init();
      client.track('chat.open');
      const r = await client.flush();
      assert.ok(r && !r.ok && r.error.code === 'bad_request', JSON.stringify(bad));
      const f = await client.forget();
      assert.ok(!f.ok && f.error.code === 'bad_request');
      assert.equal(net.sent.length, 0);
      assert.equal(client.isEnabled(), true);
    }
  });
});
