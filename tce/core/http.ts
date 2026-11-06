// Host-neutral HTTP and cron dispatch over core/ops/registry.ts. Pure: only
// ES2023 + Web APIs, no platform imports, so every host shares one semantics
// for routing, body caps, JSON, error bodies and cron runs. Hosts supply the
// body bytes, the edge and a log sink; they never re-implement any of this.

import { matchPath } from './op.ts';
import type { AnyHttpOp, CronOp, HttpRequest, HttpResponse, Logger, OpCtx, RequestCtx, TceConfig } from './op.ts';
import { HTTP_STATUS, err, ok } from './result.ts';
import type { TceError, TceResult } from './result.ts';
import type { ErrorBody } from './schema/wire.ts';

/** Path prefixes that belong to ops; every other path is the static site. */
export const OP_PATH_PREFIXES: readonly string[] = ['/api/', '/dl/'];

/** True when `path` is under one of OP_PATH_PREFIXES. */
export function isOpPath(path: string): boolean {
  return OP_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** Outcome of reading a request body under a byte cap. */
export type BodyRead =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly reason: 'too_large' | 'aborted' };

/** What a host extracts from its native request before dispatch. */
export interface HostRequest {
  method: string;
  /** URL path, not decoded (route params are decoded by matchPath). */
  path: string;
  query: Record<string, string>;
  headers: HttpRequest['headers'];
  /** Declared Content-Length, or null when absent or malformed. */
  contentLength: number | null;
  /** Reads the body and stops as soon as more than `limit` bytes arrived. */
  readBody(limit: number): Promise<BodyRead>;
}

/** What a host writes back. `body` is already serialized; null means no body. */
export interface HostResponse {
  status: number;
  /** Lowercase header names. */
  headers: Record<string, string>;
  body: string | null;
}

/** Result of matching a method and path against the registry. */
export type RouteMatch =
  | { readonly kind: 'op'; readonly op: AnyHttpOp; readonly params: Record<string, string> }
  | { readonly kind: 'method_not_allowed'; readonly allow: readonly string[] }
  | { readonly kind: 'not_found' };

/** Host hooks for dispatch. */
export interface DispatchOptions {
  /**
   * The host's rate limiter, asked once per routed request before the body is
   * read. false = over the limit: the op's `whenLimited` decides between a 429
   * and a degraded run. A throw counts as allowed (and is logged).
   */
  limit?: (op: AnyHttpOp) => Promise<boolean>;
}

/** Seconds a rate-limited client is told to wait (Retry-After). */
export const RATE_LIMIT_RETRY_AFTER_S = 60;

/** One cron op's outcome, as logged by runCron. */
export interface CronSummary {
  op: string;
  ok: boolean;
  ms: number;
  result?: Record<string, number | string>;
  error?: TceError;
}

/** Console-shaped sink for jsonLogger (console itself fits). */
export interface LogSink {
  log(line: string): void;
  warn(line: string): void;
  error(line: string): void;
}

const JSON_TYPE = 'application/json; charset=utf-8';
const ACCEPTED_BODY_TYPES = new Set(['application/json', 'text/plain']);
// Statuses that must not carry a body (a Workers Response throws if they do).
const NO_BODY_STATUS = new Set([101, 204, 205, 304]);

/** Finds the op for `method` + `path`. HEAD is served by the GET route. */
export function resolveRoute(ops: readonly AnyHttpOp[], method: string, path: string): RouteMatch {
  const wanted = method.toUpperCase() === 'HEAD' ? 'GET' : method.toUpperCase();
  const allow = new Set<string>();
  for (const op of ops) {
    const params = matchPath(op.path, path);
    if (params === null) continue;
    if (op.method === wanted) return { kind: 'op', op, params };
    allow.add(op.method);
    if (op.method === 'GET') allow.add('HEAD');
  }
  if (allow.size === 0) return { kind: 'not_found' };
  return { kind: 'method_not_allowed', allow: [...allow].sort() };
}

/**
 * Runs one HTTP request through the registry: route, rate limit, body cap,
 * JSON, parse, run, and map the TceResult (or a throw) to a HostResponse.
 * Never throws.
 */
export async function dispatch(
  req: HostRequest,
  ops: readonly AnyHttpOp[],
  ctx: RequestCtx,
  opts: DispatchOptions = {},
): Promise<HostResponse> {
  const requestId = ctx.edge.requestId;
  const method = req.method.toUpperCase();
  const head = method === 'HEAD';
  const route = resolveRoute(ops, method, req.path);

  if (route.kind === 'not_found') {
    return errorResponse({ code: 'not_found', message: `no route for ${req.path}` }, requestId, head);
  }
  if (route.kind === 'method_not_allowed') {
    // why bad_request: ErrorCode has no 405 member; the status carries the precise meaning.
    const res = errorResponse(
      { code: 'bad_request', message: `method ${method} not allowed; use ${route.allow.join(', ')}` },
      requestId,
      head,
      405,
    );
    res.headers['allow'] = route.allow.join(', ');
    return res;
  }

  const { op, params } = route;
  // Why before the body: a refused caller costs no body read, no JSON parse, no store call.
  let limited = false;
  if (opts.limit && !(await allowed(opts.limit, op, ctx))) {
    if (op.whenLimited !== 'degrade') {
      const res = errorResponse({ code: 'unavailable', message: 'rate limited' }, requestId, head, 429);
      res.headers['retry-after'] = String(RATE_LIMIT_RETRY_AFTER_S);
      return res;
    }
    limited = true;
  }

  let body: unknown = undefined;
  if (op.method !== 'GET') {
    const read = await readJsonBody(req, op.maxBodyBytes);
    if (!read.ok) return errorResponse(read.error, requestId, head);
    body = read.value;
  }

  const httpReq: HttpRequest = { method, path: req.path, params, query: req.query, headers: req.headers, body, limited };
  try {
    const parsed = op.parse(httpReq, ctx);
    if (!parsed.ok) return errorResponse(parsed.error, requestId, head);
    const out = await op.run(parsed.value, ctx);
    if (!out.ok) {
      if (out.error.code === 'internal' || out.error.code === 'unavailable') {
        ctx.log.warn('op failed', { op: op.name, code: out.error.code, error: out.error.message });
      }
      return errorResponse(out.error, requestId, head);
    }
    return successResponse(out.value, head);
  } catch (e) {
    ctx.log.error('op threw', { op: op.name, ...errorFields(e) });
    return errorResponse({ code: 'internal', message: 'internal error' }, requestId, head);
  }
}

/** Asks the limiter; a limiter that throws or rejects allows the request (a broken limiter must not take the API down). */
async function allowed(limit: NonNullable<DispatchOptions['limit']>, op: AnyHttpOp, ctx: RequestCtx): Promise<boolean> {
  try {
    return (await limit(op)) !== false;
  } catch (e) {
    // Only the error's type: a limiter's message may embed its key, which can be a client address.
    const kind = e instanceof Error ? e.name : typeof e;
    ctx.log.warn('rate limiter threw; request allowed', { op: op.name, error: kind });
    return true;
  }
}

/**
 * Runs every cron op whose schedule equals `schedule`, one after another, and
 * logs one summary line per op. Never throws.
 */
export async function runCron(ops: readonly CronOp[], schedule: string, ctx: OpCtx): Promise<CronSummary[]> {
  const due = ops.filter((op) => op.schedule === schedule);
  if (due.length === 0) {
    ctx.log.warn('no cron op for schedule', { schedule });
    return [];
  }
  const summaries: CronSummary[] = [];
  // why sequential: cron ops share one database and the retention op is write-heavy.
  for (const op of due) {
    const started = ctx.clock.now();
    let summary: CronSummary;
    try {
      const out = await op.run(ctx);
      const ms = ctx.clock.now() - started;
      summary = out.ok ? { op: op.name, ok: true, ms, result: out.value } : { op: op.name, ok: false, ms, error: out.error };
    } catch (e) {
      ctx.log.error('cron op threw', { op: op.name, ...errorFields(e) });
      summary = { op: op.name, ok: false, ms: ctx.clock.now() - started, error: { code: 'internal', message: 'cron op threw' } };
    }
    if (summary.ok) ctx.log.info('cron op done', { schedule, ...summary });
    else ctx.log.error('cron op failed', { schedule, ...summary });
    summaries.push(summary);
  }
  return summaries;
}

/** The TceConfig both hosts build from release facts and their environment. */
export function buildConfig(input: {
  appVersion: string;
  repo: string;
  githubToken: string | null | undefined;
  allowedOrigins: string | null | undefined;
  defaultOrigins?: readonly string[];
  /** Raw RETENTION_ENABLED value; only the string 'true' turns deletion on. */
  retentionEnabled?: string | null | undefined;
}): TceConfig {
  const origins = parseOriginList(input.allowedOrigins);
  return {
    release: { repo: input.repo, version: input.appVersion },
    githubToken: input.githubToken ? input.githubToken : null,
    allowedOrigins: origins.length > 0 ? origins : [...(input.defaultOrigins ?? [])],
    retentionEnabled: input.retentionEnabled?.trim().toLowerCase() === 'true',
  };
}

/** Splits a comma list of origins, trimming blanks and duplicates. */
export function parseOriginList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(',').map((s) => s.trim()).filter((s) => s.length > 0))];
}

/** Content-Length as a number, or null when absent or not a plain decimal. */
export function parseContentLength(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined || !/^\d{1,15}$/.test(raw.trim())) return null;
  return Number(raw.trim());
}

/** Concatenates chunks whose combined length is `total`. */
export function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Structured JSON-lines logger; `base` fields go on every line. */
export function jsonLogger(sink: LogSink, base: Record<string, unknown> = {}, clock?: { now(): number }): Logger {
  const emit = (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): string => {
    const record: Record<string, unknown> = { level, message, ...base, ...data };
    if (clock) record['time'] = new Date(clock.now()).toISOString();
    try {
      return JSON.stringify(record, logReplacer);
    } catch {
      return JSON.stringify({ level, message, ...base, logError: 'data not serializable' });
    }
  };
  return {
    info: (message, data) => sink.log(emit('info', message, data)),
    warn: (message, data) => sink.warn(emit('warn', message, data)),
    error: (message, data) => sink.error(emit('error', message, data)),
  };
}

/** A logger that adds `fields` to every call of `log`. */
export function childLogger(log: Logger, fields: Record<string, unknown>): Logger {
  return {
    info: (message, data) => log.info(message, { ...fields, ...data }),
    warn: (message, data) => log.warn(message, { ...fields, ...data }),
    error: (message, data) => log.error(message, { ...fields, ...data }),
  };
}

/** Loggable fields for a thrown value (Error objects serialize to {} otherwise). */
export function errorFields(e: unknown): Record<string, string> {
  if (e instanceof Error) {
    const out: Record<string, string> = { errorName: e.name, error: e.message };
    if (e.stack) out['stack'] = e.stack;
    return out;
  }
  return { error: String(e) };
}

function logReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Error) return errorFields(value);
  if (typeof value === 'bigint') return value.toString();
  return value;
}

async function readJsonBody(req: HostRequest, maxBytes: number): Promise<TceResult<unknown>> {
  // Reject on the declared length first, then enforce the cap again while
  // streaming, because the header is client-controlled (or absent if chunked).
  if (req.contentLength !== null && req.contentLength > maxBytes) {
    return err('too_large', `body is ${req.contentLength} bytes; the limit is ${maxBytes}`);
  }
  const type = mediaType(req.headers.contentType);
  // sendBeacon with a string sends text/plain; the app sends application/json.
  if (type !== null && !ACCEPTED_BODY_TYPES.has(type)) {
    return err('bad_request', 'content-type must be application/json or text/plain', 'content-type');
  }
  let read: BodyRead;
  try {
    read = await req.readBody(maxBytes);
  } catch {
    return err('bad_request', 'request body could not be read');
  }
  if (!read.ok) {
    return read.reason === 'too_large'
      ? err('too_large', `body is over the ${maxBytes}-byte limit`)
      : err('bad_request', 'request body ended early');
  }
  if (read.bytes.byteLength === 0) return ok(undefined);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(read.bytes);
  } catch {
    return err('bad_request', 'body is not valid UTF-8');
  }
  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return err('bad_request', 'body is not valid JSON');
  }
}

function mediaType(contentType: string | null): string | null {
  if (contentType === null) return null;
  const type = (contentType.split(';')[0] ?? '').trim().toLowerCase();
  return type.length > 0 ? type : null;
}

function successResponse(res: HttpResponse, head: boolean): HostResponse {
  const headers: Record<string, string> = { 'cache-control': 'no-store' };
  for (const [name, value] of Object.entries(res.headers ?? {})) headers[name.toLowerCase()] = value;
  if (res.location !== undefined) headers['location'] = res.location;
  let body: string | null = null;
  if (res.json !== undefined && !NO_BODY_STATUS.has(res.status)) {
    headers['content-type'] = JSON_TYPE;
    body = head ? null : JSON.stringify(res.json);
  }
  return { status: res.status, headers, body };
}

function errorResponse(error: TceError, requestId: string | null, head: boolean, status?: number): HostResponse {
  const payload: ErrorBody['error'] = { code: error.code, message: error.message };
  if (error.field !== undefined) payload.field = error.field;
  if (requestId) payload.requestId = requestId;
  const body: ErrorBody = { error: payload };
  return {
    status: status ?? HTTP_STATUS[error.code],
    headers: { 'content-type': JSON_TYPE, 'cache-control': 'no-store' },
    body: head ? null : JSON.stringify(body),
  };
}
