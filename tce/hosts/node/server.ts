// node:http host: the same routes and semantics as the Worker, over any Store
// (sqlite for local dev and an own server). Local dev target: `pnpm -C tce dev`.
// It does not rate limit (dispatch gets no limiter) and never reads the client
// address; an internet-facing own server puts a per-address limiter in front.

import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';

import type { Clock, IdGenerator } from '../../core/clock.ts';
import type { Edge, FetchPort, HashPort, Logger, RequestCtx, TceConfig } from '../../core/op.ts';
import { httpOps } from '../../core/ops/registry.ts';
import type { Store } from '../../core/store.ts';
import { childLogger, concatChunks, dispatch, errorFields, jsonLogger, parseContentLength } from '../../core/http.ts';
import type { BodyRead, HostRequest, HostResponse } from '../../core/http.ts';

/** Inputs for createNodeServer; everything but store and config has a Node default. */
export interface NodeServerOptions {
  store: Store;
  config: TceConfig;
  /** Default: JSON lines on stdout/stderr. */
  log?: Logger;
  /** Default: Date.now. */
  clock?: Clock;
  /** Default: node:crypto randomUUID. */
  ids?: IdGenerator;
  /** Default: global fetch. */
  fetch?: FetchPort;
}

// why: after the cap is hit the rest of the body is drained (so the 413 reaches
// the client on a live socket), but only this much; beyond it the socket is cut.
const DRAIN_LIMIT_BYTES = 1024 * 1024;

/** SHA-256 hex via node:crypto. */
export const nodeHash: HashPort = {
  sha256Hex: async (input) => createHash('sha256').update(input, 'utf8').digest('hex'),
};

/** Global fetch adapted to the FetchPort shape. */
export const nodeFetch: FetchPort = (url, init) => fetch(url, init);

/** An http.Server (not yet listening) that dispatches every request to core/ops/registry.ts. */
export function createNodeServer(opts: NodeServerOptions): Server {
  const clock: Clock = opts.clock ?? { now: () => Date.now() };
  const ids: IdGenerator = opts.ids ?? { uuid: () => randomUUID() };
  const baseLog: Logger = opts.log ?? jsonLogger(console, { host: 'node' }, clock);
  const fetchPort: FetchPort = opts.fetch ?? nodeFetch;

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const started = clock.now();
    const requestId = ids.uuid();
    const log = childLogger(baseLog, { requestId });
    const method = (req.method ?? 'GET').toUpperCase();
    const rawUrl = req.url ?? '/';
    // An absolute-form or '*' target has no path we serve.
    const url = rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? new URL(`http://localhost${rawUrl}`) : null;
    if (url === null) {
      send(res, badTarget(requestId));
      return;
    }
    const edge: Edge = { country: null, region: null, asn: null, colo: null, requestId };
    const ctx: RequestCtx = {
      store: opts.store,
      clock,
      ids,
      hash: nodeHash,
      fetch: fetchPort,
      config: opts.config,
      log,
      edge,
    };
    const hostReq: HostRequest = {
      method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: {
        userAgent: header(req, 'user-agent'),
        referer: header(req, 'referer'),
        origin: header(req, 'origin'),
        host: header(req, 'host'),
        contentType: header(req, 'content-type'),
      },
      contentLength: parseContentLength(header(req, 'content-length')),
      readBody: (limit) => readCapped(req, limit),
    };
    const out = await dispatch(hostReq, httpOps, ctx);
    send(res, out);
    log.info('request', { method, path: url.pathname, status: out.status, ms: clock.now() - started });
  };

  return createServer((req, res) => {
    handle(req, res).catch((e: unknown) => {
      // dispatch never throws; this guards the adapter itself.
      baseLog.error('node host failed', errorFields(e));
      if (!res.headersSent) {
        send(res, {
          status: 500,
          headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
          body: JSON.stringify({ error: { code: 'internal', message: 'internal error' } }),
        });
      } else {
        res.destroy();
      }
    });
  });
}

/** Reads `req` into memory, resolving too_large as soon as more than `limit` bytes arrive. */
function readCapped(req: IncomingMessage, limit: number): Promise<BodyRead> {
  return new Promise((resolve) => {
    const chunks: Uint8Array[] = [];
    let total = 0;
    let settled = false;
    const settle = (result: BodyRead): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const onData = (chunk: Buffer): void => {
      total += chunk.byteLength;
      if (settled) {
        // Draining after a 413: drop the bytes, and cut abusive uploads short.
        if (total > limit + DRAIN_LIMIT_BYTES) {
          cleanup();
          req.destroy();
        }
        return;
      }
      if (total > limit) {
        chunks.length = 0;
        settle({ ok: false, reason: 'too_large' });
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = (): void => {
      cleanup();
      settle({ ok: true, bytes: concatChunks(chunks, total) });
    };
    const onAbort = (): void => {
      cleanup();
      settle({ ok: false, reason: 'aborted' });
    };
    const cleanup = (): void => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onAbort);
      req.off('close', onAbort);
      // Keep draining without listeners so keep-alive survives an early 413.
      req.resume();
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onAbort);
    req.on('close', onAbort);
  });
}

function header(req: IncomingMessage, name: string): string | null {
  const value = req.headers[name];
  if (value === undefined) return null;
  return Array.isArray(value) ? value.join(', ') : value;
}

function send(res: ServerResponse, out: HostResponse): void {
  const headers: Record<string, string> = { ...out.headers };
  if (out.body !== null) headers['content-length'] = String(Buffer.byteLength(out.body));
  res.writeHead(out.status, headers);
  res.end(out.body ?? undefined);
}

function badTarget(requestId: string): HostResponse {
  return {
    status: 400,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    body: JSON.stringify({ error: { code: 'bad_request', message: 'request target must be a path', requestId } }),
  };
}
