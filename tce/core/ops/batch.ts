// POST /api/batch: one flush from the app. Identity, device, sessions, events
// and errors become normalized rows written atomically by the store. Client
// times are corrected by the batch's clock skew; unknown event names are
// dropped and counted; props, counters and error text are bounded and redacted.
// The device verifier travels on the device row: the store pins the first one
// per device and answers `forbidden` (403) to a write that carries another, or
// that names a session owned by another device.

import { deviceRowOf, readIdentity, UUID, type Identity } from '../identity.ts';
import type { HashPort, HttpOp, HttpResponse, RequestCtx } from '../op.ts';
import { ok, type TceResult } from '../result.ts';
import { isEventName } from '../schema/events.ts';
import { LIMITS } from '../schema/limits.ts';
import type { Bit, ErrorRow, EventRow, SessionRow } from '../schema/rows.ts';
import type { AppWire, BatchResponse, DeviceWire } from '../schema/wire.ts';
import type { BatchWrite } from '../store.ts';
import { Reader } from '../validate.ts';
import {
  readApp,
  readDevice,
  readEach,
  readEnvelope,
  readError,
  readEvent,
  readSession,
  sanitizeCounters,
  sanitizeProps,
  type ParsedError,
  type ParsedEvent,
  type ParsedSession,
} from '../wire-read.ts';

/** A validated, truncated batch. */
export interface BatchInput {
  batchId: string;
  sentAt: number;
  identity: Identity;
  device: DeviceWire;
  app: AppWire;
  sessions: ParsedSession[];
  events: ParsedEvent[];
  errors: ParsedError[];
}

/** Validate a BatchRequest body: shape, id formats, list caps; strings truncated to LIMITS. */
export function parseBatch(body: unknown): TceResult<BatchInput> {
  const r = new Reader();
  const o = readEnvelope(r, body);
  return r.done({
    batchId: r.match(o.batchId, 'batchId', UUID, 'a lowercase UUID'),
    sentAt: r.epochMs(o.sentAt, 'sentAt'),
    identity: readIdentity(r, o.identity, 'identity'),
    device: readDevice(r, o.device, 'device'),
    app: readApp(r, o.app, 'app'),
    sessions: readEach(r, o.sessions, 'sessions', LIMITS.sessionsPerBatch, readSession),
    events: readEach(r, o.events, 'events', LIMITS.eventsPerBatch, readEvent),
    errors: readEach(r, o.errors, 'errors', LIMITS.errorsPerBatch, readError),
  });
}

/**
 * error_key: SHA-256 hex of kind, class, top frame and version, newline-joined.
 * Inputs are the redacted, truncated values, so the same bug on two devices
 * (different home paths) gets the same key.
 */
export function errorKey(hash: HashPort, kind: string, className: string, topFrame: string, version: string): Promise<string> {
  return hash.sha256Hex(`${kind}\n${className}\n${topFrame}\n${version}`);
}

function bit(v: boolean | null): Bit | null {
  return v === null ? null : v ? 1 : 0;
}

/** Turn a parsed batch into the rows one atomic store write takes. */
export async function buildBatchWrite(
  input: BatchInput,
  ctx: Pick<RequestCtx, 'edge' | 'hash'>,
  received: number,
): Promise<{ write: BatchWrite; droppedEvents: number }> {
  // Why skew: phone clocks drift or are set wrong; `ts` puts every row on
  // the server's timeline while `ts_client` keeps what the phone said.
  const skew = received - input.sentAt;
  const { installId, deviceId } = input.identity;
  const { app, device } = input;
  const country = ctx.edge.country;

  const events: EventRow[] = [];
  let droppedEvents = 0;
  const seenEvents = new Set<string>();
  for (const e of input.events) {
    if (!isEventName(e.name)) {
      droppedEvents++;
      continue;
    }
    const key = `${e.sessionId}\u0000${e.seq}`;
    if (seenEvents.has(key)) continue; // first occurrence wins, like the store's insert-or-ignore
    seenEvents.add(key);
    events.push({
      session_id: e.sessionId,
      seq: e.seq,
      install_id: installId,
      device_id: deviceId,
      name: e.name,
      props: sanitizeProps(e.props),
      ts_client: e.ts,
      ts: e.ts + skew,
      received,
    });
  }

  const base = {
    install_id: installId,
    device_id: deviceId,
    version: app.version,
    version_code: app.versionCode,
    channel: app.channel,
    country,
    received,
  };
  // A session re-sent twice in one batch: the last copy is the latest state.
  const sessions = new Map<string, SessionRow>();
  for (const s of input.sessions) {
    sessions.set(s.sessionId, {
      ...base,
      // Why the session's own build wins: a session queued before an app
      // update is flushed by the updated process, whose batch app is newer.
      version: s.version ?? app.version,
      version_code: s.versionCode ?? app.versionCode,
      channel: s.channel ?? app.channel,
      session_id: s.sessionId,
      started: s.startedAt + skew,
      ended: s.endedAt === null ? null : s.endedAt + skew,
      boot_ms: s.bootMs,
      engine_ok: bit(s.engineOk),
      engine_exit_code: s.engineExitCode,
      engine_stderr_tail: s.engineStderrTail,
      low_memory_trims: s.lowMemoryTrims,
      battery_opt_ignored: bit(s.batteryOptIgnored),
      fg_service_ok: bit(s.fgServiceOk),
      a11y_on: bit(s.a11yOn),
      counters: sanitizeCounters(s.counters),
    });
  }
  // The store contract needs a session row for every event; a session the
  // client did not describe (e.g. its entry was dropped from the queue) gets a
  // minimal one that a later full copy merges into.
  const minimal = new Set<string>();
  for (const e of events) {
    const existing = sessions.get(e.session_id);
    if (!existing) {
      minimal.add(e.session_id);
      sessions.set(e.session_id, {
        ...base,
        session_id: e.session_id,
        started: e.ts,
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
      });
    } else if (minimal.has(e.session_id) && e.ts < existing.started) {
      existing.started = e.ts;
    }
  }

  const seenErrors = new Set<string>();
  const uniqueErrors = input.errors.filter((e) => !seenErrors.has(e.errorId) && Boolean(seenErrors.add(e.errorId)));
  const errors: ErrorRow[] = await Promise.all(
    uniqueErrors.map(async (e): Promise<ErrorRow> => {
      const version = e.version ?? app.version;
      return {
        error_id: e.errorId,
        error_key: await errorKey(ctx.hash, e.kind, e.className, e.frames[0] ?? '', version),
        kind: e.kind,
        session_id: e.sessionId,
        seq: e.seq,
        install_id: installId,
        device_id: deviceId,
        version,
        class_name: e.className,
        message: e.message,
        frames: JSON.stringify(e.frames),
        ts_client: e.ts,
        ts: e.ts + skew,
        received,
      };
    }),
  );

  const write: BatchWrite = {
    device: deviceRowOf(input.identity, device, ctx.edge, received),
    install: {
      install_id: installId,
      device_id: deviceId,
      channel: app.channel,
      install_source: device.installSource,
      first_version: app.version,
      last_version: app.version,
      last_version_code: app.versionCode,
      first_seen: received,
      last_seen: received,
    },
    sessions: [...sessions.values()],
    events,
    errors,
  };
  return { write, droppedEvents };
}

/** POST /api/batch. */
export const batchOp: HttpOp<BatchInput> = {
  kind: 'http',
  name: 'batch',
  method: 'POST',
  path: '/api/batch',
  maxBodyBytes: LIMITS.batchBodyBytes,

  parse(req) {
    return parseBatch(req.body);
  },

  async run(input, ctx): Promise<TceResult<HttpResponse>> {
    const received = ctx.clock.now();
    const { write, droppedEvents } = await buildBatchWrite(input, ctx, received);
    const applied = await ctx.store.applyBatch(write);
    if (!applied.ok) return applied;
    const json: BatchResponse = { serverTime: received, accepted: applied.value, droppedEvents };
    return ok({ status: 200, json });
  },
};
