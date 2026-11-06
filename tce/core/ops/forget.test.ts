import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { callHttp, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import {
  DEVICE_ID,
  DEVICE_ID_2,
  DEVICE_PROOF,
  DEVICE_PROOF_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  INSTALL_ID_2,
  INSTALL_ID_3,
  SESSION_ID_2,
  SESSION_ID_3,
  STRANGER_PROOF,
  batchRequest,
  eventWire,
  forgetRequest,
  httpRequest,
  identityWire,
  reportRequest,
  sessionWire,
  REPORT_ID_2,
} from '../../testkit/fixtures.ts';
import { dispatch, type HostRequest } from '../http.ts';
import type { AnyHttpOp, HttpResponse } from '../op.ts';
import { HTTP_STATUS, err, type TceResult } from '../result.ts';
import { batchOp } from './batch.ts';
import { forgetOp, parseForget, proofVerifier } from './forget.ts';
import { httpOps } from './registry.ts';
import { reportOp } from './report.ts';

function setup(store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store });
}

function forget(ctx: FakeCtx<MemoryStore>, body: unknown): Promise<TceResult<HttpResponse>> {
  return callHttp(forgetOp, httpRequest({ path: '/v1/forget', body }), ctx);
}

async function seed(ctx: FakeCtx<MemoryStore>, body: unknown, op: AnyHttpOp = batchOp, path = '/v1/batch'): Promise<void> {
  const r = await callHttp(op, httpRequest({ path, body }), ctx);
  if (!r.ok) assert.fail(`seed failed: ${JSON.stringify(r.error)}`);
}

/** POST /v1/forget through the host-neutral dispatch, as a host would. */
function postForget(ctx: FakeCtx<MemoryStore>, body: unknown): Promise<{ status: number; body: string | null }> {
  return post(ctx, '/v1/forget', body);
}

/** POST a JSON body to `path` through the host-neutral dispatch over the real registry. */
function post(ctx: FakeCtx<MemoryStore>, path: string, body: unknown): Promise<{ status: number; body: string | null }> {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const req: HostRequest = {
    method: 'POST',
    path,
    query: {},
    headers: { userAgent: null, referer: null, origin: null, host: null, contentType: 'application/json', secFetchMode: null },
    contentLength: bytes.byteLength,
    readBody: async () => ({ ok: true, bytes }),
  };
  return dispatch(req, httpOps, ctx);
}

describe('forget', () => {
  it('derives the verifier as SHA-256 of the proof hex string', async () => {
    assert.equal(await proofVerifier(setup(), DEVICE_PROOF), DEVICE_VERIFIER);
  });

  it('answers not_found (404) for a device the store has never seen', async () => {
    const ctx = setup();
    const r = await forget(ctx, forgetRequest());
    assert.deepEqual(r, { ok: false, error: { code: 'not_found', message: 'no data for this device' } });
    assert.equal(HTTP_STATUS.not_found, 404);
  });

  it('a wrong proof answers 404 with the same message and leaves every row intact', async () => {
    const ctx = setup();
    await seed(ctx, batchRequest());
    await seed(ctx, reportRequest(), reportOp, '/v1/report');
    const before = JSON.stringify(ctx.store.tables);
    // The attacker knows the victim's deviceId (e.g. from a leaked log), not its proof.
    for (const deviceProof of [STRANGER_PROOF, DEVICE_PROOF_2, DEVICE_VERIFIER]) {
      const r = await forget(ctx, forgetRequest({ deviceProof }));
      assert.deepEqual(r, { ok: false, error: { code: 'not_found', message: 'no data for this device' } }, deviceProof);
      const res = await postForget(ctx, forgetRequest({ deviceProof }));
      assert.equal(res.status, 404);
    }
    assert.equal(JSON.stringify(ctx.store.tables), before, 'nothing was deleted');
  });

  it('the right proof deletes every install of the device and leaves other devices alone (200 with counts)', async () => {
    const ctx = setup();
    await seed(ctx, batchRequest());
    // The same phone reinstalled: a new installId, the same deviceId and verifier.
    await seed(
      ctx,
      batchRequest({
        identity: identityWire({ installId: INSTALL_ID_2 }),
        sessions: [sessionWire({ sessionId: SESSION_ID_2 })],
        events: [eventWire({ sessionId: SESSION_ID_2 })],
        errors: [],
      }),
    );
    await seed(ctx, reportRequest(), reportOp, '/v1/report');
    // Another phone.
    const other = identityWire({ installId: INSTALL_ID_3, deviceId: DEVICE_ID_2, deviceVerifier: DEVICE_VERIFIER_2 });
    await seed(ctx, batchRequest({ identity: other, sessions: [sessionWire({ sessionId: SESSION_ID_3 })], events: [eventWire({ sessionId: SESSION_ID_3 })], errors: [] }));
    await seed(ctx, reportRequest({ reportId: REPORT_ID_2, identity: other, sessionId: SESSION_ID_3 }), reportOp, '/v1/report');

    const res = await postForget(ctx, forgetRequest());
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.body!), {
      deleted: { devices: 1, installs: 2, sessions: 2, events: 3, errors: 1, reports: 1 },
    });
    assert.deepEqual(
      Object.fromEntries(Object.entries(ctx.store.tables).map(([t, rows]) => [t, rows.map((r) => (r as { device_id?: string }).device_id)])),
      {
        devices: [DEVICE_ID_2],
        installs: [DEVICE_ID_2],
        sessions: [DEVICE_ID_2],
        events: [DEVICE_ID_2],
        errors: [],
        reports: [DEVICE_ID_2],
        github_assets_daily: [],
        github_repo_daily: [],
        site_daily: [],
      },
    );
    assert.equal(ctx.store.tables.devices.some((d) => d.device_id === DEVICE_ID), false);
    const again = await forget(ctx, forgetRequest());
    assert.equal(!again.ok && again.error.code, 'not_found');
    // The other phone forgets itself with its own proof.
    const second = await forget(ctx, forgetRequest({ deviceId: DEVICE_ID_2, deviceProof: DEVICE_PROOF_2 }));
    assert.equal(second.ok && second.value.status, 200);
    for (const rows of Object.values(ctx.store.tables)) assert.deepEqual(rows, []);
  });

  it('a phone that only ever sent a report can delete it: the report pinned the device, forget answers 200 (through dispatch)', async () => {
    const ctx = setup();
    const other = identityWire({ installId: INSTALL_ID_3, deviceId: DEVICE_ID_2, deviceVerifier: DEVICE_VERIFIER_2 });
    const sent = await post(ctx, '/v1/report', reportRequest({ identity: other, sessionId: null }));
    assert.equal(sent.status, 200, String(sent.body));
    assert.deepEqual(ctx.store.tables.reports.map((r) => r.device_id), [DEVICE_ID_2]);
    assert.deepEqual(ctx.store.tables.devices.map((d) => [d.device_id, d.verifier]), [[DEVICE_ID_2, DEVICE_VERIFIER_2]]);

    // A wrong proof still finds nothing.
    const wrong = await post(ctx, '/v1/forget', forgetRequest({ deviceId: DEVICE_ID_2, deviceProof: STRANGER_PROOF }));
    assert.equal(wrong.status, 404);
    assert.equal(ctx.store.tables.reports.length, 1);

    const res = await post(ctx, '/v1/forget', forgetRequest({ deviceId: DEVICE_ID_2, deviceProof: DEVICE_PROOF_2 }));
    assert.equal(res.status, 200, String(res.body));
    assert.deepEqual(JSON.parse(res.body!), { deleted: { devices: 1, installs: 0, sessions: 0, events: 0, errors: 0, reports: 1 } });
    for (const rows of Object.values(ctx.store.tables)) assert.deepEqual(rows, []);
    assert.equal((await post(ctx, '/v1/forget', forgetRequest({ deviceId: DEVICE_ID_2, deviceProof: DEVICE_PROOF_2 }))).status, 404);
  });

  it('validates the body: schema, deviceId and deviceProof shapes', () => {
    const cases: [unknown, string, string | undefined][] = [
      [{ deviceId: DEVICE_ID, deviceProof: DEVICE_PROOF }, 'unsupported', 'schema'],
      [forgetRequest({ deviceId: DEVICE_ID_2.toUpperCase() }), 'bad_request', 'deviceId'],
      [forgetRequest({ deviceProof: DEVICE_PROOF.toUpperCase() }), 'bad_request', 'deviceProof'],
      [forgetRequest({ deviceProof: DEVICE_PROOF.slice(1) }), 'bad_request', 'deviceProof'],
      [{ schema: 1, deviceId: DEVICE_ID }, 'bad_request', 'deviceProof'],
      ['forget me', 'bad_request', undefined],
    ];
    for (const [body, code, field] of cases) {
      const r = parseForget(body);
      if (r.ok) assert.fail(`expected a rejection of ${JSON.stringify(body)}`);
      assert.deepEqual([r.error.code, r.error.field], [code, field]);
    }
    assert.deepEqual(parseForget(forgetRequest()), { ok: true, value: { deviceId: DEVICE_ID, deviceProof: DEVICE_PROOF } });
  });

  it('passes other store failures through', async () => {
    const store = createMemoryStore();
    const ctx = setup({ ...store, forget: async () => err('unavailable', 'down') });
    assert.deepEqual(await forget(ctx, forgetRequest()), { ok: false, error: { code: 'unavailable', message: 'down' } });
  });

  it('hands the store the hashed proof, never the proof itself', async () => {
    const store = createMemoryStore();
    const seen: string[][] = [];
    const ctx = setup({
      ...store,
      forget: async (deviceId, verifier) => {
        seen.push([deviceId, verifier]);
        return store.forget(deviceId, verifier);
      },
    });
    await forget(ctx, forgetRequest());
    assert.deepEqual(seen, [[DEVICE_ID, DEVICE_VERIFIER]]);
  });
});
