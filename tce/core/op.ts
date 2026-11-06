// An operation is the unit of server behaviour: one file in core/ops/, one
// line in core/ops/registry.ts. Hosts turn the registry into routes and cron
// handlers; ops never see HTTP frameworks, cron APIs or platform types.

import type { Clock, IdGenerator } from './clock.ts';
import type { TceResult } from './result.ts';
import type { Store } from './store.ts';

/** Request metadata from the edge. The raw IP is never passed in. */
export interface Edge {
  country: string | null; // ISO 3166-1 alpha-2
  region: string | null;
  asn: number | null;
  colo: string | null;
  /** Host request id (Cloudflare: cf-ray). */
  requestId: string | null;
}

export interface Logger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/** Minimal fetch, so ops that call out (GitHub) stay testable. */
export interface FetchPort {
  (
    url: string,
    init?: { method?: string; headers?: Record<string, string> },
  ): Promise<{ status: number; ok: boolean; json(): Promise<unknown>; text(): Promise<string> }>;
}

/** SHA-256 hex of a UTF-8 string. Hosts back it with Web Crypto. */
export interface HashPort {
  sha256Hex(input: string): Promise<string>;
}

export interface TceConfig {
  /** Current public release, for /dl and the GitHub counters. */
  release: { repo: string; version: string };
  /** Optional fine-grained PAT (Administration: read) for repo traffic. */
  githubToken: string | null;
  /** Origins allowed to post /api/hit, e.g. https://phonecando.tarf.app. */
  allowedOrigins: readonly string[];
  /**
   * The retention cron deletes expired rows only when true. Off for now
   * (decided 2026-11-06): the code stays and is tested; the published docs
   * still promise RETENTION_DAYS, so scripts/check-limits.mjs warns before the
   * oldest kept row passes that age. Cloudflare: var RETENTION_ENABLED.
   */
  retentionEnabled: boolean;
}

export interface OpCtx {
  store: Store;
  clock: Clock;
  ids: IdGenerator;
  hash: HashPort;
  fetch: FetchPort;
  config: TceConfig;
  log: Logger;
}

export interface RequestCtx extends OpCtx {
  edge: Edge;
}

/** What a host hands an http op. The host has already enforced maxBodyBytes and parsed JSON. */
export interface HttpRequest {
  method: string;
  path: string;
  /** Route params, e.g. { channel: 'lite' } for /dl/:channel. */
  params: Record<string, string>;
  query: Record<string, string>;
  headers: {
    userAgent: string | null;
    referer: string | null;
    origin: string | null;
    host: string | null;
    contentType: string | null;
  };
  /** Parsed JSON body, or undefined when there was none. */
  body: unknown;
  /**
   * The host's rate limiter refused this caller and the op declared
   * `whenLimited: 'degrade'`: answer normally but skip side effects (no write).
   */
  limited: boolean;
}

export interface HttpResponse {
  status: number;
  /** Serialized as application/json when present. */
  json?: unknown;
  /** Set for redirects (status 302). */
  location?: string;
  headers?: Record<string, string>;
}

export interface HttpOp<In> {
  readonly kind: 'http';
  readonly name: string;
  readonly method: 'GET' | 'POST';
  /** Exact path or with `:param` segments, e.g. '/dl/:channel'. */
  readonly path: string;
  /** 0 for bodiless GET routes. */
  readonly maxBodyBytes: number;
  /**
   * Over the host's rate limit: 'reject' answers 429 before parse (default);
   * 'degrade' runs the op with req.limited = true so it can answer without
   * writing (page views, download redirects).
   */
  readonly whenLimited?: 'reject' | 'degrade';
  parse(req: HttpRequest, ctx: RequestCtx): TceResult<In>;
  run(input: In, ctx: RequestCtx): Promise<TceResult<HttpResponse>>;
}

export interface CronOp {
  readonly kind: 'cron';
  readonly name: string;
  /** Standard 5-field cron expression, UTC. */
  readonly schedule: string;
  run(ctx: OpCtx): Promise<TceResult<Record<string, number | string>>>;
}

// The registry holds ops with different input types; `any` is confined here.
export type AnyHttpOp = HttpOp<any>;
export type Op = AnyHttpOp | CronOp;

/** Match '/dl/:channel' against '/dl/lite'. Returns params, or null when it does not match. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/');
  const a = path.split('/');
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    const seg = p[i]!;
    const val = a[i]!;
    if (seg.startsWith(':')) {
      if (!val) return null;
      try {
        params[seg.slice(1)] = decodeURIComponent(val);
      } catch {
        return null; // malformed percent-encoding
      }
    } else if (seg !== val) {
      return null;
    }
  }
  return params;
}
