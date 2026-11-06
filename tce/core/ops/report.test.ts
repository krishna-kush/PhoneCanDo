import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { callHttp, fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import {
  DAY_MS,
  DEVICE_ID,
  DEVICE_ID_2,
  DEVICE_VERIFIER,
  DEVICE_VERIFIER_2,
  INSTALL_ID,
  INSTALL_ID_3,
  REPORT_ID,
  REPORT_ID_2,
  SESSION_ID,
  STRANGER_VERIFIER,
  T0,
  batchRequest,
  deviceRow,
  deviceWire,
  eventWire,
  httpRequest,
  identityWire,
  reportRequest,
  reportRow,
} from '../../testkit/fixtures.ts';
import { dispatch, type HostRequest } from '../http.ts';
import type { HttpResponse } from '../op.ts';
import { HTTP_STATUS, err, type TceResult } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import type { DeviceRow, ReportRow } from '../schema/rows.ts';
import type { EventWire } from '../schema/wire.ts';
import { utf8Length } from '../validate.ts';
import { batchOp } from './batch.ts';
import { fitReportRow, parseReport, reportOp, reportRowBytes } from './report.ts';
import { httpOps } from './registry.ts';

function setup(store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store, now: T0 + 1234 });
}

function send(ctx: FakeCtx<MemoryStore>, body: unknown): Promise<TceResult<HttpResponse>> {
  return callHttp(reportOp, httpRequest({ path: '/v1/report', body }), ctx);
}

/** A fresh lowercase UUID v4 per n, for seeding many reports. */
function reportId(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

async function seedReports(store: MemoryStore, count: number, received: number, from = 1000): Promise<void> {
  for (let i = 0; i < count; i++) {
    const r = await store.insertReport(reportRow({ report_id: reportId(from + i), received }), deviceRow());
    assert.equal(r.ok && r.value.inserted, true);
  }
}

/** POST a raw JSON text body through dispatch over the real registry, body cap included. */
async function postRaw(ctx: FakeCtx<MemoryStore>, text: string): Promise<{ status: number; json: unknown }> {
  const bytes = new TextEncoder().encode(text);
  const req: HostRequest = {
    method: 'POST',
    path: '/v1/report',
    query: {},
    headers: { userAgent: null, referer: null, origin: null, host: null, contentType: 'application/json', secFetchMode: null },
    contentLength: bytes.byteLength,
    readBody: async (limit) => (bytes.byteLength > limit ? { ok: false, reason: 'too_large' } : { ok: true, bytes }),
  };
  const res = await dispatch(req, httpOps, ctx);
  return { status: res.status, json: res.body === null ? null : (JSON.parse(res.body) as unknown) };
}

describe('report', () => {
  it('stores one row and answers 200 with the id and server time', async () => {
    const ctx = setup();
    const r = await send(ctx, reportRequest());
    assert.deepEqual(r, { ok: true, value: { status: 200, json: { reportId: REPORT_ID, serverTime: T0 + 1234 } } });
    assert.deepEqual(ctx.store.tables.reports, [
      {
        report_id: REPORT_ID,
        install_id: INSTALL_ID,
        device_id: DEVICE_ID,
        session_id: SESSION_ID,
        version: '0.1.2',
        channel: 'lite',
        note: 'terminal froze after rotate',
        events: JSON.stringify([eventWire()]),
        log_tail: 'serve: listening on 127.0.0.1:4097\n',
        device: JSON.stringify(deviceWire()),
        received: T0 + 1234,
      },
    ]);
  });

  it('is idempotent on reportId: a resend answers 200 and keeps the first row', async () => {
    const ctx = setup();
    await send(ctx, reportRequest());
    ctx.clock.advance(5000);
    const again = await send(ctx, reportRequest({ note: 'resent' }));
    assert.equal(again.ok && again.value.status, 200);
    assert.equal(ctx.store.tables.reports.length, 1);
    assert.equal(ctx.store.tables.reports[0]!.note, 'terminal froze after rotate');
  });

  it('accepts a report without session, note, log tail or events', async () => {
    const ctx = setup();
    const { note: _n, logTail: _l, ...rest } = reportRequest({ sessionId: null, events: [] });
    const r = await send(ctx, rest);
    assert.equal(r.ok, true);
    const [row] = ctx.store.tables.reports;
    assert.deepEqual([row!.session_id, row!.note, row!.log_tail, row!.events], [null, null, null, '[]']);
  });

  it('redacts and truncates the note and keeps the end of the log tail', async () => {
    const ctx = setup();
    const logTail = 'START' + 'l'.repeat(LIMITS.logTail) + '\nfailed to read /data/user/0/com.phonecando.app/files/home/acme/prompt.md';
    await send(
      ctx,
      reportRequest({ note: 'crash while opening /storage/emulated/0/Documents/plan.txt ' + 'n'.repeat(1000), logTail }),
    );
    const [row] = ctx.store.tables.reports;
    assert.ok(row!.note!.startsWith('crash while opening <path> n'));
    assert.equal(Array.from(row!.note!).length, LIMITS.reportNote);
    assert.equal(row!.log_tail!.length, LIMITS.logTail);
    assert.ok(row!.log_tail!.endsWith('\nfailed to read <path>'));
    assert.ok(!row!.log_tail!.includes('START'));
  });

  it('stores only vocabulary events, with props bounded like batch events', async () => {
    const ctx = setup();
    const events: EventWire[] = [
      eventWire({ seq: 1, name: 'engine.died', props: { code: 137, deep: { x: 1 } as unknown as string, long: 'v'.repeat(300) } }),
      eventWire({ seq: 2, name: 'user.typed.secret' }),
      eventWire({ seq: 3, name: 'terminal.open', props: {} }),
    ];
    await send(ctx, reportRequest({ events }));
    assert.deepEqual(JSON.parse(ctx.store.tables.reports[0]!.events), [
      { sessionId: SESSION_ID, seq: 1, ts: T0 - 1000, name: 'engine.died', props: { code: 137, long: 'v'.repeat(LIMITS.propStringLength) } },
      { sessionId: SESSION_ID, seq: 3, ts: T0 - 1000, name: 'terminal.open' },
    ]);
  });

  it('rejects over-cap event lists, other schemas and bad ids', () => {
    const tooMany = Array.from({ length: LIMITS.reportEvents + 1 }, (_, i) => eventWire({ seq: i }));
    const cases: [unknown, string, string][] = [
      [reportRequest({ events: tooMany }), 'too_large', 'events'],
      [{ ...reportRequest(), schema: 0 }, 'unsupported', 'schema'],
      [reportRequest({ reportId: 'r1' }), 'bad_request', 'reportId'],
      [reportRequest({ sessionId: 'abc' }), 'bad_request', 'sessionId'],
      [reportRequest({ identity: identityWire({ deviceId: 'x' }) }), 'bad_request', 'identity.deviceId'],
      [reportRequest({ note: 5 as unknown as string }), 'bad_request', 'note'],
      [reportRequest({ events: [eventWire({ seq: -2 })] }), 'bad_request', 'events.0.seq'],
    ];
    for (const [body, code, field] of cases) {
      const r = parseReport(body);
      if (r.ok) assert.fail(`expected ${field} to be rejected`);
      assert.deepEqual([r.error.code, r.error.field], [code, field]);
    }
    assert.equal(parseReport(reportRequest({ events: tooMany.slice(1) })).ok, true);
  });

  it('passes a store failure through', async () => {
    const store = createMemoryStore();
    const ctx = setup({ ...store, insertReport: async () => err('unavailable', 'down') });
    const r = await send(ctx, reportRequest());
    assert.deepEqual(r, { ok: false, error: { code: 'unavailable', message: 'down' } });
    const counting = setup({ ...store, countReportsSince: async () => err('unavailable', 'db busy') });
    assert.deepEqual(await send(counting, reportRequest()), { ok: false, error: { code: 'unavailable', message: 'db busy' } });
    assert.equal(store.tables.reports.length, 0);
  });

  it('redacts credentials in the note and the log tail', async () => {
    const ctx = setup();
    await send(
      ctx,
      reportRequest({
        note: 'my key sk-proj-abcdefghijklmnop1234 stopped working',
        logTail: 'POST /v1/messages\nAuthorization: Bearer abcdefghijklmnop\n{"password":"hunter2"}\n',
      }),
    );
    const [row] = ctx.store.tables.reports;
    assert.equal(row!.note, 'my key <secret> stopped working');
    assert.equal(row!.log_tail, 'POST /v1/messages\nAuthorization: Bearer <secret>\n{"password":"<secret>"}\n');
  });
});

describe('report ownership', () => {
  it("answers 403 to a report under a pinned device's id with another verifier, and stores nothing", async () => {
    const ctx = setup();
    const seeded = await callHttp(batchOp, httpRequest({ path: '/v1/batch', body: batchRequest() }), ctx);
    assert.equal(seeded.ok, true, 'the victim pinned DEVICE_VERIFIER with its first batch');

    const devicesBefore = ctx.store.tables.devices;

    ctx.clock.advance(1000);
    const attack = reportRequest({
      identity: identityWire({ deviceVerifier: STRANGER_VERIFIER }),
      device: deviceWire({ model: 'Attacker' }),
      note: 'spam',
    });
    const res = await postRaw(ctx, JSON.stringify(attack));
    assert.equal(res.status, 403);
    assert.equal((res.json as { error: { code: string } }).error.code, 'forbidden');
    assert.equal(HTTP_STATUS.forbidden, 403);
    assert.equal(ctx.store.tables.reports.length, 0);
    assert.deepEqual(ctx.store.tables.devices, devicesBefore, 'the refused report merged nothing into the device');

    const own = await postRaw(ctx, JSON.stringify(reportRequest()));
    assert.equal(own.status, 200);
    assert.deepEqual(
      ctx.store.tables.reports.map((r) => [r.device_id, r.note]),
      [[DEVICE_ID, 'terminal froze after rotate']],
    );
  });

  it('pins a device that has never sent a batch: its device row is created exactly as a batch would create it', async () => {
    const other = identityWire({ installId: INSTALL_ID_3, deviceId: DEVICE_ID_2, deviceVerifier: DEVICE_VERIFIER_2, drmId: 'e5'.repeat(32) });
    const device = deviceWire({ model: 'Pixel 9', tester: true });
    const ctx = setup();
    const res = await postRaw(ctx, JSON.stringify(reportRequest({ identity: other, device })));
    assert.equal(res.status, 200);
    assert.deepEqual(ctx.store.tables.reports.map((r) => r.device_id), [DEVICE_ID_2]);
    assert.equal(ctx.store.tables.installs.length, 0, 'a report writes no install');

    // The same phone's first batch at the same moment, on a fresh store.
    const viaBatch = setup();
    const batched = await callHttp(batchOp, httpRequest({ path: '/v1/batch', body: batchRequest({ identity: other, device }) }), viaBatch);
    assert.equal(batched.ok, true);
    assert.deepEqual(ctx.store.tables.devices, viaBatch.store.tables.devices);
    assert.deepEqual(ctx.store.tables.devices, [
      {
        device_id: DEVICE_ID_2,
        verifier: DEVICE_VERIFIER_2,
        hw_hash: other.hwHash,
        drm_id: 'e5'.repeat(32),
        manufacturer: device.manufacturer,
        model: 'Pixel 9',
        sdk_int: device.sdkInt,
        abi: device.abi,
        ram_gb: device.ramGb,
        locale: device.locale,
        country: ctx.edge.country,
        asn: ctx.edge.asn,
        tester: 1,
        first_seen: T0 + 1234,
        last_seen: T0 + 1234,
      },
    ]);

    // Pinned: a later batch or report under that deviceId with another verifier is refused.
    const stranger = identityWire({ installId: INSTALL_ID_3, deviceId: DEVICE_ID_2, deviceVerifier: STRANGER_VERIFIER });
    const batch = await callHttp(batchOp, httpRequest({ path: '/v1/batch', body: batchRequest({ identity: stranger }) }), ctx);
    assert.equal(!batch.ok && batch.error.code, 'forbidden');
    assert.equal((await postRaw(ctx, JSON.stringify(reportRequest({ reportId: REPORT_ID_2, identity: stranger })))).status, 403);
    assert.equal(ctx.store.tables.reports.length, 1);
  });

  it('requires a well-formed deviceVerifier and hands the store the device row with it', async () => {
    const bad = parseReport(reportRequest({ identity: identityWire({ deviceVerifier: 'x' }) }));
    assert.deepEqual(!bad.ok && [bad.error.code, bad.error.field], ['bad_request', 'identity.deviceVerifier']);
    const store = createMemoryStore();
    const seen: [ReportRow, DeviceRow][] = [];
    const ctx = setup({
      ...store,
      insertReport: async (row, device) => {
        seen.push([row, device]);
        return store.insertReport(row, device);
      },
    });
    await send(ctx, reportRequest());
    assert.equal(seen.length, 1);
    const [row, device] = seen[0]!;
    assert.deepEqual([device.device_id, device.verifier, row.device_id], [DEVICE_ID, DEVICE_VERIFIER, DEVICE_ID]);
    assert.deepEqual([device.first_seen, device.last_seen, row.received], [T0 + 1234, T0 + 1234, T0 + 1234]);
  });
});

describe('report daily cap (reviewer scenario)', () => {
  it(`accepts ${LIMITS.reportsPerDay} reports per UTC day, then answers unavailable (503) until the next day`, async () => {
    const ctx = setup();
    // Yesterday's reports do not count against today.
    await seedReports(ctx.store, LIMITS.reportsPerDay, T0 - 1, 5000);
    await seedReports(ctx.store, LIMITS.reportsPerDay - 1, T0);
    const last = await send(ctx, reportRequest());
    assert.equal(last.ok && last.value.status, 200, 'the 100th report of the day is accepted');

    const over = await send(ctx, reportRequest({ reportId: REPORT_ID_2 }));
    assert.deepEqual(over, { ok: false, error: { code: 'unavailable', message: 'the daily report limit is reached; retry tomorrow' } });
    assert.equal(HTTP_STATUS.unavailable, 503);
    assert.equal(ctx.store.tables.reports.some((r) => r.report_id === REPORT_ID_2), false);
    assert.equal(ctx.store.tables.reports.length, 2 * LIMITS.reportsPerDay);

    // Late on the same UTC day: still refused. The next UTC day: accepted.
    ctx.clock.set(T0 + DAY_MS - 1);
    assert.equal((await send(ctx, reportRequest({ reportId: REPORT_ID_2 }))).ok, false);
    ctx.clock.set(T0 + DAY_MS);
    const tomorrow = await send(ctx, reportRequest({ reportId: REPORT_ID_2 }));
    assert.equal(tomorrow.ok && tomorrow.value.status, 200);
  });

  it('counts from the start of the current UTC day', async () => {
    const store = createMemoryStore();
    const since: number[] = [];
    const ctx = setup({
      ...store,
      countReportsSince: async (t) => {
        since.push(t);
        return store.countReportsSince(t);
      },
    });
    ctx.clock.set(T0 + 13 * 3_600_000 + 7);
    await send(ctx, reportRequest());
    assert.deepEqual(since, [T0]);
  });
});

describe('report row-size cap (reviewer scenario)', () => {
  const KEYS = 'abcdefghijklmnop'.split('');

  /** 50 events whose props are 16 numbers written as `1e20`: 4 bytes on the wire, 21 digits when re-serialized. */
  function inflatingBody(): string {
    const props = `{${KEYS.map((k) => `"${k}":1e20`).join(',')}}`;
    const events = Array.from(
      { length: LIMITS.reportEvents },
      (_, i) => `{"sessionId":"${SESSION_ID}","seq":${i},"ts":${T0 - 100_000 + i},"name":"chat.open","props":${props}}`,
    );
    const shell = JSON.stringify(reportRequest({ events: [] }));
    return shell.replace('"events":[]', `"events":[${events.join(',')}]`);
  }

  it('drops the oldest events until the stored row fits, for a body under the 16 KB cap', async () => {
    const ctx = setup();
    const body = inflatingBody();
    assert.ok(utf8Length(body) <= LIMITS.reportBodyBytes, `body is ${utf8Length(body)} bytes`);
    const res = await postRaw(ctx, body);
    assert.equal(res.status, 200);

    const [row] = ctx.store.tables.reports;
    assert.ok(reportRowBytes(row!) <= LIMITS.reportRowBytes, `stored row is ${reportRowBytes(row!)} bytes`);
    const kept = JSON.parse(row!.events) as EventWire[];
    assert.ok(kept.length > 0 && kept.length < LIMITS.reportEvents, `kept ${kept.length}`);
    // The newest survive, in order.
    assert.deepEqual(
      kept.map((e) => e.seq),
      Array.from({ length: kept.length }, (_, i) => LIMITS.reportEvents - kept.length + i),
    );
    assert.equal(kept[0]!.props!['a'], 1e20);
    // As many as fit: one more (the next older) would go over.
    const oneMore = [{ ...kept[0]!, seq: kept[0]!.seq - 1, ts: kept[0]!.ts - 1 }, ...kept];
    assert.ok(reportRowBytes({ ...row!, events: JSON.stringify(oneMore) }) > LIMITS.reportRowBytes);
    // Without the cap the stored row would have been over it.
    const all = Array.from({ length: LIMITS.reportEvents }, (_, i) => ({ ...kept[0]!, seq: i, ts: T0 - 100_000 + i }));
    assert.ok(reportRowBytes({ ...row!, events: JSON.stringify(all) }) > LIMITS.reportRowBytes);
    assert.equal(ctx.log.entries.find((e) => e.message.startsWith('report: oldest events dropped'))?.data?.['dropped'], LIMITS.reportEvents - kept.length);
  });

  it('measures the stored row in UTF-8 bytes of its columns', () => {
    const row: ReportRow = reportRow({ note: 'é\u{1F600}', events: '[]', log_tail: null, received: 12345 });
    const expected =
      utf8Length(row.report_id) +
      utf8Length(row.install_id) +
      utf8Length(row.device_id) +
      utf8Length(row.session_id!) +
      utf8Length(row.version) +
      utf8Length(row.channel) +
      (2 + 4) +
      2 +
      utf8Length(row.device) +
      5;
    assert.equal(reportRowBytes(row), expected);
  });

  it('fitReportRow keeps everything that fits, and gives up only when the row is too big without events', () => {
    const { events: _e, ...base } = reportRow();
    const small = [eventWire({ seq: 1 }), eventWire({ seq: 2 })];
    assert.deepEqual(fitReportRow(base, small), { row: { ...base, events: JSON.stringify(small) }, dropped: 0 });
    assert.deepEqual(fitReportRow(base, []), { row: { ...base, events: '[]' }, dropped: 0 });
    const huge = { ...base, log_tail: 'x'.repeat(LIMITS.reportRowBytes) };
    assert.equal(fitReportRow(huge, small), null);
    // Exactly at the cap fits.
    const room = LIMITS.reportRowBytes - reportRowBytes({ ...base, events: '[]', log_tail: '' });
    const exact = fitReportRow({ ...base, log_tail: 'y'.repeat(room) }, []);
    assert.ok(exact !== null && reportRowBytes(exact.row) === LIMITS.reportRowBytes);
  });
});
