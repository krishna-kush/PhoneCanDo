// What the Worker test files share: the exported handlers called directly with
// an env from wrangler's getPlatformProxy (local D1 with every shared
// migration; no account, no network) plus a recording ASSETS, recording
// Analytics Engine datasets and fake Rate Limiting bindings, and a console
// capture of the Worker's own log lines. Test-only: index.ts never imports it.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy, unstable_readConfig, unstable_splitSqlQuery } from 'wrangler';

import { SHARED_MIGRATIONS_DIR, loadMigrations } from '../../stores/sqlite/migrate.ts';
import { UA } from '../../testkit/fixtures.ts';
import worker from './index.ts';
import type { Env } from './index.ts';

const CONFIG_PATH = fileURLToPath(new URL('./wrangler.jsonc', import.meta.url));
/** Every shared migration (0001, 0002, 0003, ...), in the order wrangler applies them. */
export const MIGRATIONS = loadMigrations(SHARED_MIGRATIONS_DIR);
export const BASE = 'https://phonecando.app';
const CF = { country: 'IN', regionCode: 'KA', region: 'Karnataka', asn: 24560, colo: 'BLR', city: 'Bengaluru' };
/** The client address every request carries unless a test says otherwise. */
export const CLIENT_IP = '203.0.113.77';
export const CLIENT_IP6 = '2001:db8:85a3:12:8a2e:370:7334:1';
/** Substrings of the client addresses that must never be stored or logged. */
export const ADDRESS_NEEDLES: readonly string[] = [CLIENT_IP, CLIENT_IP6, '2001:db8:85a3:12'];

/** A fake that records what it was called with. */
export interface Recorded<T> {
  calls: T[];
}

/** Analytics Engine dataset fake that records every data point. */
function recordingDataset(): AnalyticsEngineDataset & Recorded<AnalyticsEngineDataPoint | undefined> {
  const calls: Array<AnalyticsEngineDataPoint | undefined> = [];
  return { calls, writeDataPoint: (p) => void calls.push(p) };
}

/** ASSETS fake answering every path with a small HTML page and recording the URL. */
function recordingAssets(): Fetcher & Recorded<string> {
  const calls: string[] = [];
  const fetcher = {
    calls,
    fetch: async (input: RequestInfo | URL): Promise<Response> => {
      calls.push(input instanceof Request ? input.url : String(input));
      return new Response('<!doctype html><title>PhoneCanDo</title>', { status: 200, headers: { 'content-type': 'text/html' } });
    },
    connect: () => {
      throw new Error('not used');
    },
  };
  return fetcher as unknown as Fetcher & Recorded<string>;
}

/** Workers Rate Limiting binding fake: records each key; `answer` decides (or throws). */
export function fakeLimiter(answer: (key: string) => boolean): RateLimit & Recorded<string> {
  const calls: string[] = [];
  return {
    calls,
    limit: async ({ key }) => {
      calls.push(key);
      return { success: answer(key) };
    },
  };
}

/** How a test shapes one request. */
export interface CallOptions {
  method?: string;
  body?: string | ReadableStream<Uint8Array>;
  headers?: Record<string, string>;
  cf?: Record<string, unknown> | null;
  /** cf-connecting-ip / x-forwarded-for value; null sends neither. Default CLIENT_IP. */
  ip?: string | null;
}

/** A Request as Cloudflare's edge would hand it over (request.cf set unless `cf: null`). */
export function cfRequest(path: string, opts: CallOptions = {}): Request {
  const ip = opts.ip === undefined ? CLIENT_IP : opts.ip;
  const init: RequestInit & { duplex?: 'half' } = {
    method: opts.method ?? 'GET',
    headers: { 'user-agent': UA.android, ...(ip === null ? {} : { 'cf-connecting-ip': ip, 'x-forwarded-for': ip }), ...opts.headers },
  };
  if (opts.body !== undefined) {
    init.body = opts.body;
    if (typeof opts.body !== 'string') init.duplex = 'half';
  }
  const request = new Request(`${BASE}${path}`, init);
  // request.cf is set by the Cloudflare edge; Node's Request has none.
  if (opts.cf !== null) Object.defineProperty(request, 'cf', { value: opts.cf ?? CF });
  return request;
}

/** A body stream of `bytes` spaces, sent in 8 KB chunks. */
export function stream(bytes: number): ReadableStream<Uint8Array> {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes) {
        controller.close();
        return;
      }
      const n = Math.min(8192, bytes - sent);
      sent += n;
      controller.enqueue(new Uint8Array(n).fill(0x20));
    },
  });
}

/** One Worker under test: its env (set in `before`), the fakes and the helpers that drive it. */
export interface WorkerHarness {
  /** The env every call uses by default; valid once the calling suite's `before` ran. */
  env: Env;
  readonly pageviews: Recorded<AnalyticsEngineDataPoint | undefined>;
  readonly downloads: Recorded<AnalyticsEngineDataPoint | undefined>;
  readonly assets: Recorded<string>;
  /** Every console line the Worker printed since setup. */
  readonly printed: Array<{ stream: string; line: string }>;
  /** Promises handed to ctx.waitUntil. */
  readonly pending: Promise<unknown>[];
  readonly ctx: ExecutionContext;
  call(path: string, opts?: CallOptions, on?: Env): Promise<Response>;
  postJson(path: string, value: unknown, headers?: Record<string, string>): Promise<Response>;
  /** The parsed log lines with this message. */
  logs(message: string): Record<string, unknown>[];
  count(table: string): Promise<number>;
  /** The site_daily rollup without its day column (the ops stamp today's UTC day), in key order. */
  rollup(): Promise<Record<string, unknown>[]>;
  /** Run the Worker's scheduled() for `cron` at `scheduledTime` and wait for its work. */
  schedule(cron: string, scheduledTime?: number, on?: Env): Promise<void>;
}

/**
 * Registers `before`/`after` hooks in the calling suite that start a local D1
 * (every shared migration applied), capture console output and tear it all
 * down; returns the harness the suite's tests use.
 */
export function useWorker(): WorkerHarness {
  const dir = mkdtempSync(join(tmpdir(), 'tce-cf-host-'));
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>> | undefined;
  const pending: Promise<unknown>[] = [];
  const printed: Array<{ stream: string; line: string }> = [];
  const ctx = {
    waitUntil: (p: Promise<unknown>) => void pending.push(p),
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext;
  const pageviews = recordingDataset();
  const downloads = recordingDataset();
  const assets = recordingAssets();

  const h: WorkerHarness = {
    env: undefined as unknown as Env,
    pageviews,
    downloads,
    assets,
    printed,
    pending,
    ctx,
    call: (path, opts = {}, on = h.env) => worker.fetch(cfRequest(path, opts) as Request<unknown, IncomingRequestCfProperties>, on, ctx),
    postJson: (path, value, headers = {}) =>
      h.call(path, { method: 'POST', body: JSON.stringify(value), headers: { 'content-type': 'application/json', ...headers } }),
    logs: (message) => printed.map((p) => JSON.parse(p.line) as Record<string, unknown>).filter((l) => l['message'] === message),
    count: async (table) => (await h.env.DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<{ n: number }>())?.n ?? -1,
    rollup: async () =>
      (await h.env.DB.prepare('SELECT kind, key, country, count FROM site_daily ORDER BY day, kind, key, country').all<Record<string, unknown>>())
        .results,
    async schedule(cron, scheduledTime = Date.now(), on = h.env) {
      pending.length = 0;
      worker.scheduled({ cron, scheduledTime, noRetry: () => undefined }, on, ctx);
      await Promise.all(pending);
    },
  };

  before(async () => {
    for (const m of ['log', 'info', 'warn', 'error'] as const) {
      mock.method(console, m, (...args: unknown[]) => void printed.push({ stream: m, line: args.map(String).join(' ') }));
    }
    // A test config derived from the real one: same Worker name, date and D1 binding.
    const real = unstable_readConfig({ config: CONFIG_PATH });
    const db = real.d1_databases[0]!;
    const testConfig = join(dir, 'wrangler.json');
    writeFileSync(
      testConfig,
      JSON.stringify({
        name: real.name,
        compatibility_date: real.compatibility_date,
        d1_databases: [{ binding: db.binding, database_name: db.database_name, ...(db.database_id ? { database_id: db.database_id } : {}) }],
      }),
    );
    const started = await getPlatformProxy<Env>({ configPath: testConfig, persist: { path: join(dir, 'state') }, remoteBindings: false });
    proxy = started;
    for (const m of MIGRATIONS) {
      await started.env.DB.batch(unstable_splitSqlQuery(m.sql).map((s) => started.env.DB.prepare(s)));
    }
    h.env = {
      ...started.env,
      ASSETS: assets,
      PAGEVIEWS: pageviews,
      DOWNLOADS: downloads,
      ALLOWED_ORIGINS: real.vars['ALLOWED_ORIGINS'] as string,
    };
    // Only the Worker's own log lines from here on.
    printed.length = 0;
  });

  after(async () => {
    mock.restoreAll();
    await proxy?.dispose();
    rmSync(dir, { recursive: true, force: true });
  });

  return h;
}
