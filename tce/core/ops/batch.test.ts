import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { callHttp, fakeCtx, webHash, type FakeCtx } from '../../testkit/ctx.ts';
import {
  DEVICE_ID,
  DEVICE_ID_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  DRM_ID,
  ERROR_ID,
  ERROR_ID_2,
  INSTALL_ID_2,
  INSTALL_ID_3,
  SESSION_ID,
  SESSION_ID_2,
  STRANGER_VERIFIER,
  T0,
  batchRequest,
  deviceWire,
  errorWire,
  eventWire,
  httpRequest,
  identityWire,
  appWire,
  sessionWire,
} from '../../testkit/fixtures.ts';
import { dispatch, type HostRequest } from '../http.ts';
import { HTTP_STATUS, err, type TceError } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import type { BatchResponse } from '../schema/wire.ts';
import { batchOp, errorKey, parseBatch, type BatchInput } from './batch.ts';
import { httpOps } from './registry.ts';

const HOUR = 3_600_000;

function setup(store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store });
}

function parsed(body: unknown): BatchInput {
  const r = parseBatch(body);
  if (!r.ok) assert.fail(`expected a valid batch: ${JSON.stringify(r.error)}`);
  return r.value;
}

function rejected(body: unknown): TceError {
  const r = parseBatch(body);
  if (r.ok) assert.fail('expected the batch to be rejected');
  return r.error;
}

async function send(ctx: FakeCtx<MemoryStore>, body: unknown): Promise<BatchResponse> {
  const r = await callHttp(batchOp, httpRequest({ path: '/api/batch', body }), ctx);
  if (!r.ok) assert.fail(`batch failed: ${JSON.stringify(r.error)}`);
  assert.equal(r.value.status, 200);
  return r.value.json as BatchResponse;
}

const long = (n: number, ch = 'x') => ch.repeat(n);

/** POST a JSON body through the host-neutral dispatch over the real registry, as a host would. */
async function post(ctx: FakeCtx<MemoryStore>, path: string, body: unknown): Promise<{ status: number; json: unknown }> {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const req: HostRequest = {
    method: 'POST',
    path,
    query: {},
    headers: { userAgent: null, referer: null, origin: null, host: null, contentType: 'application/json' },
    contentLength: bytes.byteLength,
    readBody: async () => ({ ok: true, bytes }),
  };
  const res = await dispatch(req, httpOps, ctx);
  return { status: res.status, json: res.body === null ? null : (JSON.parse(res.body) as unknown) };
}

describe('batch parse', () => {
  it('accepts the fixture request', () => {
    const input = parsed(batchRequest());
    assert.equal(input.identity.drmId, null);
    assert.equal(input.events.length, 2);
    assert.equal(input.sessions[0]!.endedAt, null);
  });

  it('rejects a body that is not an object', () => {
    for (const body of [undefined, null, 'x', 1, [batchRequest()]]) assert.equal(rejected(body).code, 'bad_request');
  });

  it('rejects another schema version as unsupported, before anything else', () => {
    assert.deepEqual(rejected({ ...batchRequest(), schema: 2, identity: null }), {
      code: 'unsupported',
      message: 'schema must be 1',
      field: 'schema',
    });
    const { schema: _omit, ...noSchema } = batchRequest();
    assert.equal(rejected(noSchema).code, 'unsupported');
  });

  it('checks id shapes and reports the field', () => {
    const cases: [unknown, string][] = [
      [batchRequest({ identity: identityWire({ installId: '6F1C2A3B-4D5E-4F60-8A1B-2C3D4E5F6A7B' }) }), 'identity.installId'],
      [batchRequest({ identity: identityWire({ installId: '6f1c2a3b-4d5e-1f60-8a1b-2c3d4e5f6a7b' }) }), 'identity.installId'],
      [batchRequest({ identity: identityWire({ deviceId: 'a'.repeat(63) }) }), 'identity.deviceId'],
      [batchRequest({ identity: identityWire({ hwHash: 'G'.repeat(64) }) }), 'identity.hwHash'],
      [batchRequest({ identity: identityWire({ drmId: 'abc' }) }), 'identity.drmId'],
      [batchRequest({ identity: identityWire({ deviceVerifier: DEVICE_VERIFIER.toUpperCase() }) }), 'identity.deviceVerifier'],
      [batchRequest({ identity: identityWire({ deviceVerifier: DEVICE_VERIFIER.slice(2) }) }), 'identity.deviceVerifier'],
      [batchRequest({ identity: { ...identityWire(), deviceVerifier: undefined as unknown as string } }), 'identity.deviceVerifier'],
      [batchRequest({ batchId: 'not-a-uuid' }), 'batchId'],
      [batchRequest({ events: [eventWire({ sessionId: 'nope' })] }), 'events.0.sessionId'],
      [batchRequest({ errors: [errorWire({ errorId: '' })] }), 'errors.0.errorId'],
    ];
    for (const [body, field] of cases) assert.deepEqual([rejected(body).code, rejected(body).field], ['bad_request', field]);
    assert.equal(parsed(batchRequest({ identity: identityWire({ drmId: DRM_ID }) })).identity.drmId, DRM_ID);
    assert.equal(parsed(batchRequest()).identity.deviceVerifier, DEVICE_VERIFIER);
  });

  it("reads a session's own version, versionCode and channel, all optional", () => {
    const input = parsed(
      batchRequest({
        sessions: [
          sessionWire({ version: '0.1.1', versionCode: 11, channel: 'full' }),
          sessionWire({ sessionId: SESSION_ID_2, version: long(90, '1') }),
        ],
      }),
    );
    assert.deepEqual(
      input.sessions.map((s) => [s.version, s.versionCode, s.channel]),
      [
        ['0.1.1', 11, 'full'],
        [long(LIMITS.shortText, '1'), null, null],
      ],
    );
    const cases: [unknown, string][] = [
      [batchRequest({ sessions: [sessionWire({ channel: 'beta' as 'lite' })] }), 'sessions.0.channel'],
      [batchRequest({ sessions: [sessionWire({ versionCode: -1 })] }), 'sessions.0.versionCode'],
      [batchRequest({ sessions: [sessionWire({ versionCode: 1.5 })] }), 'sessions.0.versionCode'],
      [batchRequest({ sessions: [sessionWire({ version: 12 as unknown as string })] }), 'sessions.0.version'],
    ];
    for (const [body, field] of cases) assert.deepEqual([rejected(body).code, rejected(body).field], ['bad_request', field], field);
  });

  it('accepts only the known channels', () => {
    for (const channel of ['full', 'lite', 'play'] as const) assert.equal(parsed(batchRequest({ app: appWire({ channel }) })).app.channel, channel);
    const bad = rejected(batchRequest({ app: appWire({ channel: 'beta' as 'lite' }) }));
    assert.deepEqual([bad.code, bad.field], ['bad_request', 'app.channel']);
  });

  it('rejects lists over their caps as too_large with the field', () => {
    const events = Array.from({ length: LIMITS.eventsPerBatch + 1 }, (_, i) => eventWire({ seq: i }));
    const sessions = Array.from({ length: LIMITS.sessionsPerBatch + 1 }, () => sessionWire());
    const errors = Array.from({ length: LIMITS.errorsPerBatch + 1 }, () => errorWire());
    for (const [body, field] of [
      [batchRequest({ events }), 'events'],
      [batchRequest({ sessions }), 'sessions'],
      [batchRequest({ errors }), 'errors'],
    ] as const) {
      const e = rejected(body);
      assert.deepEqual([e.code, e.field], ['too_large', field]);
    }
    assert.equal(parsed(batchRequest({ events: events.slice(1) })).events.length, LIMITS.eventsPerBatch);
  });

  it('rejects insane numbers', () => {
    const cases: [unknown, string][] = [
      [batchRequest({ events: [eventWire({ seq: -1 })] }), 'events.0.seq'],
      [batchRequest({ events: [eventWire({ seq: 1.5 })] }), 'events.0.seq'],
      [batchRequest({ events: [eventWire({ ts: Math.floor(T0 / 1000) })] }), 'events.0.ts'], // seconds, not ms
      [batchRequest({ events: [eventWire({ ts: Number.POSITIVE_INFINITY })] }), 'events.0.ts'],
      [batchRequest({ sentAt: -5 }), 'sentAt'],
      [batchRequest({ sessions: [sessionWire({ bootMs: -1 })] }), 'sessions.0.bootMs'],
      [batchRequest({ sessions: [sessionWire({ lowMemoryTrims: 0.5 })] }), 'sessions.0.lowMemoryTrims'],
      [batchRequest({ device: deviceWire({ sdkInt: 0 }) }), 'device.sdkInt'],
      [batchRequest({ device: deviceWire({ ramGb: Number.NaN }) }), 'device.ramGb'],
      [batchRequest({ app: appWire({ versionCode: -3 }) }), 'app.versionCode'],
    ];
    for (const [body, field] of cases) {
      const e = rejected(body);
      assert.deepEqual([e.code, e.field], ['bad_request', field], field);
    }
  });

  it('rejects broken shapes', () => {
    const cases: [unknown, string][] = [
      [batchRequest({ events: [eventWire({ props: [1, 2] as unknown as Record<string, string> })] }), 'events.0.props'],
      [batchRequest({ sessions: [sessionWire({ counters: 'x' as unknown as Record<string, number> })] }), 'sessions.0.counters'],
      [batchRequest({ errors: [errorWire({ frames: 'at x' as unknown as string[] })] }), 'errors.0.frames'],
      [batchRequest({ errors: [errorWire({ frames: [42 as unknown as string] })] }), 'errors.0.frames.0'],
      [batchRequest({ errors: [errorWire({ kind: 'python' as 'js' })] }), 'errors.0.kind'],
      [batchRequest({ device: deviceWire({ tester: 'yes' as unknown as boolean }) }), 'device.tester'],
      [{ ...batchRequest(), events: undefined }, 'events'],
    ];
    for (const [body, field] of cases) {
      const e = rejected(body);
      assert.deepEqual([e.code, e.field], ['bad_request', field], field);
    }
  });

  it('truncates long strings instead of rejecting them', () => {
    const input = parsed(
      batchRequest({
        device: deviceWire({ model: long(100), manufacturer: long(70), installSource: long(80) }),
        app: appWire({ version: long(90, '1') }),
        sessions: [sessionWire({ engineStderrTail: 'HEAD' + long(LIMITS.stderrTail * 2) + 'TAIL' })],
        errors: [
          errorWire({
            className: long(500),
            message: long(1000),
            frames: Array.from({ length: 8 }, (_, i) => `${i}`.repeat(400)),
            version: long(99, '9'),
          }),
        ],
      }),
    );
    assert.equal(input.device.model.length, LIMITS.shortText);
    assert.equal(input.device.manufacturer.length, LIMITS.shortText);
    assert.equal(input.device.installSource!.length, LIMITS.shortText);
    assert.equal(input.app.version.length, LIMITS.shortText);
    const tail = input.sessions[0]!.engineStderrTail!;
    assert.equal(tail.length, LIMITS.stderrTail);
    assert.ok(tail.endsWith('TAIL'), 'a tail keeps its end');
    const e = input.errors[0]!;
    assert.equal(e.className.length, LIMITS.errorClass);
    assert.equal(e.message.length, LIMITS.errorMessage);
    assert.equal(e.frames.length, LIMITS.errorFrames);
    assert.ok(e.frames.every((f, i) => f === `${i}`.repeat(LIMITS.errorFrameLength)));
    assert.equal(e.version!.length, LIMITS.shortText);
  });

  it('truncates by code point, never splitting an emoji', () => {
    const input = parsed(batchRequest({ device: deviceWire({ model: '\u{1F4F1}'.repeat(70) }) }));
    assert.equal(Array.from(input.device.model).length, LIMITS.shortText);
    assert.equal(input.device.model, '\u{1F4F1}'.repeat(LIMITS.shortText));
  });
});

describe('batch run', () => {
  it('writes device, install, session, events and errors and answers 200', async () => {
    const ctx = setup();
    ctx.clock.set(T0 + 250);
    const res = await send(ctx, batchRequest({ identity: identityWire({ drmId: DRM_ID }), device: deviceWire({ tester: true }) }));
    assert.deepEqual(res, { serverTime: T0 + 250, accepted: { sessions: 1, events: 2, errors: 1 }, droppedEvents: 0 });

    const [device] = ctx.store.tables.devices;
    assert.deepEqual(device, {
      device_id: identityWire().deviceId,
      verifier: DEVICE_VERIFIER,
      hw_hash: identityWire().hwHash,
      drm_id: DRM_ID,
      manufacturer: 'Google',
      model: 'Pixel 8',
      sdk_int: 36,
      abi: 'arm64-v8a',
      ram_gb: 8,
      locale: 'en-IN',
      country: 'IN',
      asn: 24560,
      tester: 1,
      first_seen: T0 + 250,
      last_seen: T0 + 250,
    });
    assert.deepEqual(ctx.store.tables.installs, [
      {
        install_id: identityWire().installId,
        device_id: identityWire().deviceId,
        channel: 'lite',
        install_source: 'com.android.chrome',
        first_version: '0.1.2',
        last_version: '0.1.2',
        last_version_code: 12,
        first_seen: T0 + 250,
        last_seen: T0 + 250,
      },
    ]);
    const [session] = ctx.store.tables.sessions;
    assert.equal(session!.engine_ok, 1);
    assert.equal(session!.a11y_on, 0);
    assert.equal(session!.counters, '{"tool.mobile_click":3}');
    assert.equal(session!.country, 'IN');
    assert.equal(session!.received, T0 + 250);
    const terminal = ctx.store.tables.events.find((e) => e.seq === 2)!;
    assert.equal(terminal.props, '{"source":"tab","cols":80,"ime":true}');
  });

  it('corrects every client time by the batch clock skew', async () => {
    const ctx = setup();
    // Phone clock one hour behind the server.
    const sentAt = T0 - HOUR;
    ctx.clock.set(T0);
    await send(
      ctx,
      batchRequest({
        sentAt,
        sessions: [sessionWire({ startedAt: sentAt - 60_000, endedAt: sentAt - 5_000 })],
        events: [eventWire({ ts: sentAt - 1000 })],
        errors: [errorWire({ ts: sentAt - 500 })],
      }),
    );
    const [event] = ctx.store.tables.events;
    assert.deepEqual([event!.ts_client, event!.ts, event!.received], [sentAt - 1000, T0 - 1000, T0]);
    const [error] = ctx.store.tables.errors;
    assert.deepEqual([error!.ts_client, error!.ts], [sentAt - 500, T0 - 500]);
    const [session] = ctx.store.tables.sessions;
    assert.deepEqual([session!.started, session!.ended], [T0 - 60_000, T0 - 5_000]);
  });

  it('dedupes events by (sessionId, seq) within the batch, first wins', async () => {
    const ctx = setup();
    const res = await send(
      ctx,
      batchRequest({
        events: [eventWire({ seq: 1, name: 'chat.open' }), eventWire({ seq: 1, name: 'terminal.open' }), eventWire({ seq: 2 })],
      }),
    );
    assert.deepEqual(res.accepted.events, 2);
    assert.deepEqual(
      ctx.store.tables.events.map((e) => [e.seq, e.name]),
      [
        [1, 'chat.open'],
        [2, 'chat.open'],
      ],
    );
  });

  it('drops and counts events with unknown names; a valid duplicate of a dropped key survives', async () => {
    const ctx = setup();
    const res = await send(
      ctx,
      batchRequest({
        events: [
          eventWire({ seq: 1, name: 'secret.prompt_text' }),
          eventWire({ seq: 1, name: 'tool.mobile_click' }),
          eventWire({ seq: 2, name: 'update.check.newer' }),
          eventWire({ seq: 3, name: 'a11y.step.2.done' }),
          eventWire({ seq: 4, name: 'Chat.Open' }),
          eventWire({ seq: 5, name: 'provider.anthropic' }),
        ],
      }),
    );
    assert.equal(res.droppedEvents, 2);
    assert.equal(res.accepted.events, 4);
    assert.deepEqual(
      ctx.store.tables.events.map((e) => e.name),
      ['tool.mobile_click', 'update.check.newer', 'a11y.step.2.done', 'provider.anthropic'],
    );
  });

  it('creates a minimal session for events whose session was not described', async () => {
    const ctx = setup();
    const sentAt = T0 - HOUR;
    const res = await send(
      ctx,
      batchRequest({
        sentAt,
        app: appWire({ version: '0.1.3', versionCode: 13, channel: 'full' }),
        sessions: [sessionWire()],
        events: [
          eventWire({ sessionId: SESSION_ID_2, seq: 4, ts: sentAt - 300 }),
          eventWire({ sessionId: SESSION_ID_2, seq: 2, ts: sentAt - 900 }),
          eventWire({ sessionId: SESSION_ID_2, seq: 3, ts: sentAt - 600 }),
        ],
        errors: [],
      }),
    );
    assert.equal(res.accepted.sessions, 2);
    const minimal = ctx.store.tables.sessions.find((s) => s.session_id === SESSION_ID_2);
    assert.deepEqual(minimal, {
      session_id: SESSION_ID_2,
      install_id: identityWire().installId,
      device_id: identityWire().deviceId,
      version: '0.1.3',
      version_code: 13,
      channel: 'full',
      started: T0 - 900, // earliest event, skew-corrected
      ended: null,
      boot_ms: null,
      engine_ok: null,
      engine_exit_code: null,
      engine_stderr_tail: null,
      low_memory_trims: null,
      battery_opt_ignored: null,
      fg_service_ok: null,
      a11y_on: null,
      counters: null,
      country: 'IN',
      received: T0,
    });
  });

  it('keeps the last copy of a session listed twice in one batch', async () => {
    const ctx = setup();
    const res = await send(
      ctx,
      batchRequest({ sessions: [sessionWire({ bootMs: 100 }), sessionWire({ bootMs: 200, endedAt: T0 - 10 })] }),
    );
    assert.equal(res.accepted.sessions, 1);
    assert.deepEqual([ctx.store.tables.sessions[0]!.boot_ms, ctx.store.tables.sessions[0]!.ended], [200, T0 - 10]);
  });

  it('bounds props: key count, key length, string length, value types, JSON size', async () => {
    const ctx = setup();
    const many: Record<string, string | number | boolean> = {};
    for (let i = 0; i < 20; i++) many[`k${String(i).padStart(2, '0')}`] = i;
    const mixed = {
      ok: 'x'.repeat(300),
      [long(LIMITS.propKeyLength + 1)]: 'dropped: key too long',
      nested: { a: 1 } as unknown as string,
      list: [1] as unknown as string,
      nothing: null as unknown as string,
      flag: false,
    };
    const big: Record<string, string> = {};
    for (let i = 0; i < 6; i++) big[`s${i}`] = 'y'.repeat(150);
    await send(
      ctx,
      batchRequest({
        events: [eventWire({ seq: 1, props: many }), eventWire({ seq: 2, props: mixed }), eventWire({ seq: 3, props: big }), eventWire({ seq: 4, props: {} })],
      }),
    );
    const props = (seq: number) => {
      const p = ctx.store.tables.events.find((e) => e.seq === seq)!.props;
      return p === null ? null : (JSON.parse(p) as Record<string, unknown>);
    };
    assert.deepEqual(Object.keys(props(1)!), Object.keys(many).slice(0, LIMITS.propsKeys));
    assert.deepEqual(props(2), { ok: 'x'.repeat(LIMITS.propStringLength), flag: false });
    const p3 = ctx.store.tables.events.find((e) => e.seq === 3)!.props!;
    assert.ok(new TextEncoder().encode(p3).length <= LIMITS.propsBytes);
    assert.deepEqual(Object.keys(JSON.parse(p3) as object), ['s0', 's1', 's2'], 'keys drop from the end until it fits');
    assert.equal(props(4), null);
  });

  it('bounds counters to non-negative integers with identifier keys', async () => {
    const ctx = setup();
    const counters: Record<string, number> = { 'tool.mobile_click': 4, neg: -1, frac: 1.5, 'has space': 3, 'session.create': 1 };
    (counters as Record<string, unknown>).str = '7';
    for (let i = 0; i < 80; i++) counters[`c${i}`] = i;
    await send(ctx, batchRequest({ sessions: [sessionWire({ counters })] }));
    const stored = JSON.parse(ctx.store.tables.sessions[0]!.counters!) as Record<string, number>;
    assert.equal(Object.keys(stored).length, LIMITS.counterKeys);
    assert.equal(stored['tool.mobile_click'], 4);
    assert.equal(stored['session.create'], 1);
    for (const k of ['neg', 'frac', 'has space', 'str']) assert.equal(k in stored, false, k);
  });

  it('computes a stable error_key from kind, class, top frame and version', async () => {
    const ctx = setup();
    const frame = 'at render (index.android.bundle:1:2048)';
    const expected = await webHash.sha256Hex(`js\nTypeError\n${frame}\n0.1.2`);
    assert.equal(await errorKey(webHash, 'js', 'TypeError', frame, '0.1.2'), expected);

    // Same bug on another device, with its own home path in the frame and message.
    const other = { install_id: INSTALL_ID_2, device_id: DEVICE_ID_2 };
    await send(ctx, batchRequest({ errors: [errorWire({ frames: ['at f (/data/user/0/com.phonecando.app/files/a.js:1:2)'] })] }));
    await send(
      ctx,
      batchRequest({
        identity: identityWire({ installId: other.install_id, deviceId: other.device_id, deviceVerifier: DEVICE_VERIFIER_2 }),
        sessions: [sessionWire({ sessionId: SESSION_ID_2 })],
        events: [],
        errors: [errorWire({ errorId: ERROR_ID_2, sessionId: SESSION_ID_2, frames: ['at f (/data/user/10/com.phonecando.app/files/a.js:1:2)'] })],
      }),
    );
    const keys = ctx.store.tables.errors.map((e) => e.error_key);
    assert.equal(keys.length, 2);
    assert.equal(keys[0], keys[1]);
    assert.equal(keys[0], await webHash.sha256Hex('js\nTypeError\nat f (<path>:1:2)\n0.1.2'));
  });

  it('uses the error version when given, and an empty top frame when there are none', async () => {
    const ctx = setup();
    await send(ctx, batchRequest({ errors: [errorWire({ version: '0.1.1', frames: [] })] }));
    const [row] = ctx.store.tables.errors;
    assert.equal(row!.version, '0.1.1');
    assert.equal(row!.frames, '[]');
    assert.equal(row!.error_key, await webHash.sha256Hex('js\nTypeError\n\n0.1.1'));
  });

  it('redacts device paths in error text, frames and stderr tails', async () => {
    const ctx = setup();
    await send(
      ctx,
      batchRequest({
        sessions: [sessionWire({ engineStderrTail: 'ENOENT: open /data/data/com.phonecando.app/files/home/acme/.env\nexit 1' })],
        errors: [
          errorWire({
            kind: 'native',
            className: 'java.io.FileNotFoundException',
            message: '/storage/emulated/0/Download/taxes-2026.pdf: open failed',
            frames: ['at x (file:///sdcard/notes/secret.txt:3:4)', 'at y(/sdcard/DCIM/a.jpg)'],
          }),
        ],
      }),
    );
    const [error] = ctx.store.tables.errors;
    assert.equal(error!.message, '<path>: open failed');
    assert.deepEqual(JSON.parse(error!.frames), ['at x (<path>:3:4)', 'at y(<path>)']);
    assert.equal(ctx.store.tables.sessions[0]!.engine_stderr_tail, 'ENOENT: open <path>\nexit 1');
  });

  it('redacts credentials in error text, frames and stderr tails', async () => {
    const ctx = setup();
    await send(
      ctx,
      batchRequest({
        sessions: [sessionWire({ engineStderrTail: 'provider error: Authorization: Bearer sk-ant-api03-abcdefghijklmnopqrstuv\nretrying' })],
        errors: [
          errorWire({
            className: 'HttpError ghp_abcdefghijklmnopqrstuvwxyz0123456789',
            message: 'fetch failed {"api_key":"abc123"}',
            frames: ['at call (https://api.x.test/v1?access_token=zzz)', 'at f (<path>/home/acme/a.js:1:2)'],
          }),
        ],
      }),
    );
    const [error] = ctx.store.tables.errors;
    assert.equal(error!.class_name, 'HttpError <secret>');
    assert.equal(error!.message, 'fetch failed {"api_key":"<secret>"}');
    assert.deepEqual(JSON.parse(error!.frames), ['at call (https://api.x.test/v1?access_token=<secret>)', 'at f (<path>:1:2)']);
    assert.equal(ctx.store.tables.sessions[0]!.engine_stderr_tail, 'provider error: Authorization: Bearer <secret>\nretrying');
  });

  it('dedupes errors by errorId within the batch', async () => {
    const ctx = setup();
    const res = await send(ctx, batchRequest({ errors: [errorWire({ message: 'a' }), errorWire({ message: 'b' }), errorWire({ errorId: ERROR_ID_2 })] }));
    assert.equal(res.accepted.errors, 2);
    assert.equal(ctx.store.tables.errors.find((e) => e.error_id === ERROR_ID)!.message, 'a');
  });

  it('is idempotent: a resent batch accepts no new events or errors', async () => {
    const ctx = setup();
    await send(ctx, batchRequest());
    ctx.clock.advance(60_000);
    const res = await send(ctx, batchRequest());
    assert.deepEqual(res.accepted, { sessions: 1, events: 0, errors: 0 });
    assert.equal(ctx.store.tables.events.length, 2);
    assert.equal(ctx.store.tables.devices[0]!.last_seen, T0 + 60_000);
    assert.equal(ctx.store.tables.devices[0]!.first_seen, T0);
  });

  it('passes a store failure through unchanged', async () => {
    const store = createMemoryStore();
    const ctx = setup({ ...store, applyBatch: async () => err('unavailable', 'database is down') });
    const r = await callHttp(batchOp, httpRequest({ path: '/api/batch', body: batchRequest() }), ctx);
    assert.deepEqual(r, { ok: false, error: { code: 'unavailable', message: 'database is down' } });
  });

  it('accepts an empty flush (identity only)', async () => {
    const ctx = setup();
    const res = await send(ctx, batchRequest({ sessions: [], events: [], errors: [] }));
    assert.deepEqual(res.accepted, { sessions: 0, events: 0, errors: 0 });
    assert.equal(ctx.store.tables.devices.length, 1);
    assert.equal(ctx.store.tables.sessions.length, 0);
  });

  it('stamps each session with its own build; the batch app is only the fallback', async () => {
    const ctx = setup();
    // Session queued by 0.1.1 (lite), flushed after the update by 0.1.3 (full).
    await send(
      ctx,
      batchRequest({
        app: appWire({ version: '0.1.3', versionCode: 13, channel: 'full' }),
        sessions: [
          sessionWire({ version: '0.1.1', versionCode: 11, channel: 'lite' }),
          sessionWire({ sessionId: SESSION_ID_2 }), // the new process's own session, unstamped
        ],
        events: [eventWire(), eventWire({ sessionId: SESSION_ID_2 })],
        errors: [],
      }),
    );
    const stamp = (id: string) => {
      const s = ctx.store.tables.sessions.find((r) => r.session_id === id)!;
      return [s.version, s.version_code, s.channel];
    };
    assert.deepEqual(stamp(SESSION_ID), ['0.1.1', 11, 'lite']);
    assert.deepEqual(stamp(SESSION_ID_2), ['0.1.3', 13, 'full']);
    // The install row still follows the running app.
    assert.deepEqual([ctx.store.tables.installs[0]!.last_version, ctx.store.tables.installs[0]!.channel], ['0.1.3', 'full']);
  });

  it('a session flushed after an update keeps its stamped version across resends (reviewer scenario)', async () => {
    const ctx = setup();
    const stamped = sessionWire({ version: '0.1.2', versionCode: 12, channel: 'lite' });
    await send(ctx, batchRequest({ sessions: [stamped] }));
    ctx.clock.advance(60_000);
    // The updated process re-sends the finished session with more fields.
    await send(
      ctx,
      batchRequest({
        sentAt: T0 + 60_000,
        app: appWire({ version: '0.1.3', versionCode: 13, channel: 'full' }),
        sessions: [{ ...stamped, endedAt: T0 + 30_000 }],
        events: [],
        errors: [],
      }),
    );
    const [s] = ctx.store.tables.sessions;
    assert.deepEqual([s!.version, s!.version_code, s!.channel, s!.ended], ['0.1.2', 12, 'lite', T0 + 30_000]);
  });

  it("an attacker's batch with the victim's deviceId and another verifier answers 403 and changes nothing (reviewer scenario)", async () => {
    const ctx = setup();
    const victim = await post(ctx, '/api/batch', batchRequest());
    assert.equal(victim.status, 200);
    const before = JSON.stringify(ctx.store.tables);

    const attack = batchRequest({
      identity: identityWire({ installId: INSTALL_ID_2, deviceVerifier: STRANGER_VERIFIER }),
      device: deviceWire({ model: 'Attacker', tester: true }),
      sessions: [sessionWire({ sessionId: SESSION_ID_2 })],
      events: [eventWire({ sessionId: SESSION_ID_2 })],
      errors: [errorWire({ errorId: ERROR_ID_2, sessionId: SESSION_ID_2 })],
    });
    ctx.clock.advance(1000);
    const res = await post(ctx, '/api/batch', attack);
    assert.equal(res.status, 403);
    assert.equal(HTTP_STATUS.forbidden, 403);
    assert.deepEqual((res.json as { error: { code: string } }).error.code, 'forbidden');
    assert.equal(JSON.stringify(ctx.store.tables), before, 'the victim device row and everything else is unchanged');
    assert.deepEqual(
      [ctx.store.tables.devices[0]!.model, ctx.store.tables.devices[0]!.tester, ctx.store.tables.devices[0]!.verifier],
      ['Pixel 8', 0, DEVICE_VERIFIER],
    );
  });

  it("a batch that names another device's session answers 403 and changes nothing", async () => {
    const ctx = setup();
    await send(ctx, batchRequest());
    const before = JSON.stringify(ctx.store.tables);
    const other = identityWire({ installId: INSTALL_ID_3, deviceId: DEVICE_ID_2, deviceVerifier: DEVICE_VERIFIER_2 });
    // A correctly verified device 2 tries to append to device 1's session.
    const res = await post(ctx, '/api/batch', batchRequest({ identity: other, sessions: [], events: [eventWire({ seq: 9 })], errors: [] }));
    assert.equal(res.status, 403);
    assert.equal(JSON.stringify(ctx.store.tables), before);
    assert.equal(ctx.store.tables.events.some((e) => e.device_id === DEVICE_ID_2), false);
    assert.deepEqual(ctx.store.tables.devices.map((d) => d.device_id), [DEVICE_ID]);
  });

  it('keeps the session id of an error even when the session is not in the batch', async () => {
    const ctx = setup();
    await send(ctx, batchRequest({ sessions: [], events: [], errors: [errorWire({ sessionId: SESSION_ID, seq: null })] }));
    assert.deepEqual([ctx.store.tables.errors[0]!.session_id, ctx.store.tables.errors[0]!.seq], [SESSION_ID, null]);
    assert.equal(ctx.store.tables.sessions.length, 0);
  });
});
