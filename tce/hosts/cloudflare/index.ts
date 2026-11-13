// Cloudflare Worker `phonecando`: /v1/* on the API host (API_HOSTS,
// api.phonecando.app) goes to core/ops/registry.ts, and so do the share links
// /i/* on the site's host (every other host); every other request, on any
// host, is the static site (web/dist via the ASSETS binding); and cron
// triggers run the cron ops whose schedule matches. The accounts routes
// (/v1/account*, accounts/hosts/cloudflare) answer on the API host before
// tce's own; tce and accounts share nothing else. Config lives in
// wrangler.jsonc next to this file; Workers Builds deploys it on push to prod.
// Requests are rate limited per op and client network (config.ts); the client
// address is read only for that and goes nowhere else.
//
// why only `default` (and types) are exported: workerd treats every named
// export of the entry module as a candidate entrypoint.

import type { AnyHttpOp, Edge, FetchPort, HashPort, Logger, OpCtx } from '../../core/op.ts';
import { cronOps, httpOps } from '../../core/ops/registry.ts';
import { createCloudflareStore } from '../../stores/cloudflare/index.ts';
import { childLogger, concatChunks, dispatch, isOpPath, isSiteOpPath, jsonLogger, parseContentLength, runCron } from '../../core/http.ts';
import type { BodyRead, HostRequest } from '../../core/http.ts';
import { accountsFetch } from '../../../accounts/hosts/cloudflare/index.ts';
import { accountsLimiter, configFromEnv, rateLimiter, servesApi, servesSite } from './config.ts';
import type { Env } from './config.ts';

export type { Env } from './config.ts';

/** Ops answered on the API host (/v1/*) and on the site's host (/i/*); a host never routes the other's. */
const API_OPS = httpOps.filter((op) => !isSiteOpPath(op.path));
const SITE_OPS = httpOps.filter((op) => isSiteOpPath(op.path));

/** The ops this host answers for this path, or null when it is the static site's. */
function opsFor(env: Env, url: URL): readonly AnyHttpOp[] | null {
  if (!isOpPath(url.pathname)) return null;
  if (isSiteOpPath(url.pathname)) return servesSite(env, url.hostname) ? SITE_OPS : null;
  return servesApi(env, url.hostname) ? API_OPS : null;
}

/** SHA-256 hex via Web Crypto. */
const workerHash: HashPort = {
  async sha256Hex(input) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    let hex = '';
    for (const byte of new Uint8Array(digest)) hex += byte.toString(16).padStart(2, '0');
    return hex;
  },
};

// why the arrow: workerd rejects fetch called with a foreign `this`.
const workerFetch: FetchPort = (url, init) => fetch(url, init);

/** Edge facts from request.cf. The client address never goes in (it only keys the rate limiter). */
function edgeOf(request: Request, requestId: string): Edge {
  const cf = request.cf;
  return {
    country: typeof cf?.country === 'string' ? cf.country : null,
    // why regionCode: a stable ISO 3166-2 code instead of a localized region name.
    region: typeof cf?.regionCode === 'string' ? cf.regionCode : null,
    asn: typeof cf?.asn === 'number' ? cf.asn : null,
    colo: typeof cf?.colo === 'string' ? cf.colo : null,
    requestId,
  };
}

/** Builds one op context; called per request and per cron run (no shared state). */
function opCtx(env: Env, log: Logger): OpCtx {
  return {
    store: createCloudflareStore(env, log),
    clock: { now: () => Date.now() },
    ids: { uuid: () => crypto.randomUUID() },
    hash: workerHash,
    fetch: workerFetch,
    config: configFromEnv(env),
    log,
  };
}

/** Reads a request body, cancelling the stream once more than `limit` bytes arrived. */
async function readCapped(body: ReadableStream<Uint8Array> | null, limit: number): Promise<BodyRead> {
  if (body === null) return { ok: true, bytes: new Uint8Array(0) };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel('body over limit').catch(() => undefined);
      return { ok: false, reason: 'too_large' };
    }
    chunks.push(value);
  }
  return { ok: true, bytes: concatChunks(chunks, total) };
}

function hostRequest(request: Request, url: URL): HostRequest {
  const h = request.headers;
  return {
    method: request.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    headers: {
      userAgent: h.get('user-agent'),
      referer: h.get('referer'),
      origin: h.get('origin'),
      host: h.get('host'),
      contentType: h.get('content-type'),
      secFetchMode: h.get('sec-fetch-mode'),
    },
    contentLength: parseContentLength(h.get('content-length')),
    readBody: (limit) => readCapped(request.body, limit),
  };
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url);
    if (servesApi(env, url.hostname)) {
      const log = jsonLogger(console, { requestId: request.headers.get('cf-ray') });
      const limit = accountsLimiter(env, request.headers.get('cf-connecting-ip'), log);
      const accounts = await accountsFetch(request, url, env, limit);
      if (accounts) return accounts;
    }
    // run_worker_first sends only /v1/* and /i/* here, on every host; the
    // isOpPath check keeps the Worker correct if that list and
    // OP_PATH_PREFIXES ever differ.
    const ops = opsFor(env, url);
    if (ops === null) return env.ASSETS.fetch(request);

    const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();
    const log = jsonLogger(console, { requestId });
    const ctx = { ...opCtx(env, log), edge: edgeOf(request, requestId) };
    // cf-connecting-ip is set by Cloudflare's edge (a client cannot forge it there); it keys the limiter only.
    const limit = rateLimiter(env, request.headers.get('cf-connecting-ip'), log);
    const out = await dispatch(hostRequest(request, url), ops, ctx, limit ? { limit } : {});
    return new Response(out.body, { status: out.status, headers: out.headers });
  },

  scheduled(controller, env, ctx): void {
    const log = jsonLogger(console, { cron: controller.cron });
    const run = runCron(cronOps, controller.cron, opCtx(env, childLogger(log, { scheduledTime: controller.scheduledTime })));
    ctx.waitUntil(
      run.then((summaries) => {
        log.info('cron finished', { ops: summaries.length, failed: summaries.filter((s) => !s.ok).length });
      }),
    );
  },
} satisfies ExportedHandler<Env>;
