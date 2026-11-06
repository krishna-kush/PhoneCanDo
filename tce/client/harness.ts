// Shared setup for the client tests: a client over the doubles in fakes.ts,
// the waits the tests use, and readers for what was sent or stored. Pure, so
// it type-checks under the client's own tsconfig like fakes.ts (failures
// throw a plain Error instead of using node:assert); nothing in the SDK
// imports this file.

import { parseBatch } from '../core/ops/batch.ts';
import { parseForget } from '../core/ops/forget.ts';
import { parseReport } from '../core/ops/report.ts';
import type { BatchRequest } from '../core/schema/wire.ts';
import { FakeClock, FakeEnv, FakeIds, FakeLog, FakeNet, FakeStorage } from './fakes.ts';
import { createClient } from './index.ts';
import { STORAGE_KEYS, type ClientOptions } from './types.ts';

// Node's setImmediate. The tests only run under node --test, but this file
// also type-checks under the client's tsconfig, which has no Node types.
declare const setImmediate: (callback: () => void) => unknown;

/** A lowercase v4 UUID. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** The server's 200 answer to a batch of one session and one event. */
export const OK_BATCH = { status: 200, body: { serverTime: 1, accepted: { sessions: 1, events: 1, errors: 0 }, droppedEvents: 0 } };

/** A client over fresh fakes (pass `storage` to model a restart), returned with its fakes. */
export function setup(over: Partial<ClientOptions> & { storage?: FakeStorage } = {}) {
  const storage = over.storage ?? new FakeStorage();
  const net = new FakeNet();
  const env = new FakeEnv();
  const clock = new FakeClock();
  const ids = new FakeIds();
  const log = new FakeLog();
  const client = createClient({ baseUrl: 'https://t.example/', storage, net, env, clock, ids, log, ...over });
  return { client, storage, net, env, clock, ids, log };
}

/** One turn of the event loop. */
export const tick = () => new Promise<void>((r) => setImmediate(r));
/** Waits `ms` of real time. */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Ticks until `cond` holds; throws when it still does not after 100 ticks. */
export async function until(cond: () => boolean): Promise<void> {
  for (let i = 0; i < 100 && !cond(); i++) await tick();
  if (!cond()) throw new Error('condition never became true');
}

/** Every batch request the client sent, in order. */
export function batches(net: FakeNet): BatchRequest[] {
  return net.to('/api/batch').map((r) => r.json as BatchRequest);
}

/** Throws unless every request the client sent passes the server's own parser. */
export function assertServerAccepts(net: FakeNet): void {
  for (const r of net.sent) {
    const parse = r.path === '/api/batch' ? parseBatch : r.path === '/api/report' ? parseReport : parseForget;
    const res = parse(r.json);
    if (!res.ok) throw new Error(`${r.path} rejected: ${res.error.field ?? ''} ${res.error.message}`);
  }
}

/** The stored queue as JSON, or null when nothing is stored. */
export function stored(storage: FakeStorage): { events: unknown[]; errors: unknown[]; sessions: unknown[] } | null {
  const raw = storage.data.get(STORAGE_KEYS.queue);
  return raw === undefined ? null : JSON.parse(raw);
}

/** A fixed, valid error id, as a native crash report carries. */
export function crashId(): string {
  return 'abcdef01-2345-4678-89ab-cdef01234567';
}
