// A deterministic RequestCtx for op and host tests: settable clock, sequential
// UUIDs, real SHA-256 (Web Crypto), a routed fake fetch and a logger that
// collects entries.
//
// Why `store` is required: the dependency law (scripts/check-deps.mjs) lets
// testkit import only core, so it cannot default to stores/memory. Tests
// (which may import both) pass `{ store: createMemoryStore() }`.

import type { Clock, IdGenerator } from '../core/clock.ts';
import type {
  Edge,
  FetchPort,
  HashPort,
  HttpOp,
  HttpRequest,
  HttpResponse,
  Logger,
  RequestCtx,
  TceConfig,
} from '../core/op.ts';
import type { TceResult } from '../core/result.ts';
import type { Store } from '../core/store.ts';
import { T0 } from './fixtures.ts';

/** A clock that only moves when the test moves it. */
export interface FakeClock extends Clock {
  set(ms: number): void;
  advance(ms: number): void;
}

/** One recorded fetch call. */
export interface FetchCall {
  url: string;
  init?: { method?: string; headers?: Record<string, string> };
}

/** FetchPort that answers from routes registered by the test; unrouted URLs get 404. */
export interface FakeFetch extends FetchPort {
  /** Answer every URL starting with `urlPrefix` (the longest matching prefix wins). */
  route(urlPrefix: string, status: number, jsonBody: unknown): void;
  /** Answer with a raw body; json() rejects when it is not JSON. */
  routeText(urlPrefix: string, status: number, text: string): void;
  /** Reject like a network failure. */
  fail(urlPrefix: string, message?: string): void;
  readonly calls: readonly FetchCall[];
}

/** One collected log line. */
export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

/** Logger that keeps every entry for assertions. */
export interface CollectingLogger extends Logger {
  readonly entries: readonly LogEntry[];
}

/** The ctx fakeCtx returns: a RequestCtx whose ports expose their test controls. */
export interface FakeCtx<S extends Store = Store> extends RequestCtx {
  store: S;
  clock: FakeClock;
  fetch: FakeFetch;
  log: CollectingLogger;
}

/** Overrides for fakeCtx. `config` and `edge` are merged over the defaults. */
export type FakeCtxOptions<S extends Store> = {
  store: S;
  /** Initial clock value; default T0. */
  now?: number;
  edge?: Partial<Edge>;
  config?: Partial<TceConfig>;
  ids?: IdGenerator;
  hash?: HashPort;
};

/**
 * Release, token, origins and retention every fake ctx starts with. Retention
 * is ON here so the retention tests exercise deletion; production starts with
 * it off (RETENTION_ENABLED), which has its own tests.
 */
export const DEFAULT_CONFIG: TceConfig = {
  release: { repo: 'krishna-kush/PhoneCanDo', version: '0.1.2' },
  githubToken: null,
  allowedOrigins: ['https://phonecando.app'],
  retentionEnabled: true,
};

/** An Indian request on Airtel through the Mumbai colo. */
export const DEFAULT_EDGE: Edge = {
  country: 'IN',
  region: 'MH',
  asn: 24560,
  colo: 'BOM',
  requestId: 'test-request-id',
};

/** Settable clock starting at `start`. */
export function fakeClock(start: number = T0): FakeClock {
  let now = start;
  return {
    now: () => now,
    set: (ms) => {
      now = ms;
    },
    advance: (ms) => {
      now += ms;
    },
  };
}

/** Sequential lowercase UUID v4s: ...-4000-8000-000000000001, ...002, ... */
export function sequentialIds(): IdGenerator {
  let n = 0;
  return {
    uuid: () => {
      n++;
      return `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
    },
  };
}

/** SHA-256 hex through Web Crypto. */
export const webHash: HashPort = {
  async sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  },
};

type Route =
  | { prefix: string; kind: 'json'; status: number; body: unknown }
  | { prefix: string; kind: 'text'; status: number; text: string }
  | { prefix: string; kind: 'fail'; message: string };

/** A FakeFetch with no routes. */
export function fakeFetch(): FakeFetch {
  const routes: Route[] = [];
  const calls: FetchCall[] = [];
  const respond = (status: number, text: string) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async (): Promise<unknown> => JSON.parse(text),
    text: async () => text,
  });
  const fn: FetchPort = async (url, init) => {
    calls.push(init === undefined ? { url } : { url, init });
    let best: Route | undefined;
    for (const r of routes) if (url.startsWith(r.prefix) && (!best || r.prefix.length > best.prefix.length)) best = r;
    if (!best) return respond(404, JSON.stringify({ message: 'Not Found (no fake route)' }));
    if (best.kind === 'fail') throw new TypeError(best.message);
    return respond(best.status, best.kind === 'json' ? JSON.stringify(best.body) : best.text);
  };
  return Object.assign(fn, {
    route(prefix: string, status: number, body: unknown) {
      routes.push({ prefix, kind: 'json', status, body });
    },
    routeText(prefix: string, status: number, text: string) {
      routes.push({ prefix, kind: 'text', status, text });
    },
    fail(prefix: string, message = 'network down') {
      routes.push({ prefix, kind: 'fail', message });
    },
    calls,
  });
}

/** A logger that collects entries instead of printing. */
export function collectingLogger(): CollectingLogger {
  const entries: LogEntry[] = [];
  const add = (level: LogEntry['level']) => (message: string, data?: Record<string, unknown>) => {
    entries.push(data === undefined ? { level, message } : { level, message, data });
  };
  return { entries, info: add('info'), warn: add('warn'), error: add('error') };
}

/** Parse then run an http op, as a host does after its body-size check. */
export async function callHttp<In>(op: HttpOp<In>, req: HttpRequest, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
  const input = op.parse(req, ctx);
  return input.ok ? op.run(input.value, ctx) : input;
}

/** A fresh deterministic RequestCtx around `over.store`. */
export function fakeCtx<S extends Store>(over: FakeCtxOptions<S>): FakeCtx<S> {
  return {
    store: over.store,
    clock: fakeClock(over.now ?? T0),
    ids: over.ids ?? sequentialIds(),
    hash: over.hash ?? webHash,
    fetch: fakeFetch(),
    config: { ...DEFAULT_CONFIG, ...over.config },
    log: collectingLogger(),
    edge: { ...DEFAULT_EDGE, ...over.edge },
  };
}
