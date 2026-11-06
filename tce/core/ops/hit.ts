// POST /v1/hit: one site page view from the inline beacon, posted
// cross-origin from the site (ALLOWED_ORIGINS) to the API host.
// Stores an identity-free analytics point (UTC day, path, referrer host,
// country, UA class; the store also counts it in the site_daily rollup) and
// always answers 204, even when the store is down or the caller is over the
// host's rate limit (then nothing is written).

import type { HttpOp, HttpRequest, HttpResponse, RequestCtx, TceConfig } from '../op.ts';
import { writePointSafely } from '../points.ts';
import { cleanPath, refHost } from '../referrer.ts';
import { err, ok, type TceResult } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import type { PagePoint, UaClass } from '../schema/rows.ts';
import { utcDay } from '../time.ts';
import { uaClass } from '../ua.ts';
import { Reader } from '../validate.ts';

/** A validated page view. */
export interface HitInput {
  path: string;
  refHost: string | null;
  uaClass: UaClass;
  /** Over the host's rate limit: answer 204 without writing a point. */
  limited: boolean;
}

// A raw referrer is read whole (the body is already capped at smallBodyBytes)
// because cutting a URL before parsing it could change its host.
const RAW_READ_CAP = LIMITS.smallBodyBytes;

/** True when `origin` may post beacons: listed in config, or the request's own https origin. */
export function originAllowed(origin: string | null, host: string | null, config: TceConfig): boolean {
  if (!origin) return false;
  if (config.allowedOrigins.includes(origin)) return true;
  return host !== null && origin === `https://${host}`;
}

/** Host of an allowed Origin header (the page that sent the beacon), or null. */
function originHost(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    return null;
  }
}

/**
 * Validate a hit: origin first (forbidden), then `{ path, ref? }`. A referrer
 * on the page's own host is internal navigation, so the site host comes from
 * Origin: the beacon is posted to the API host, not to the page's host.
 */
export function parseHit(req: HttpRequest, config: TceConfig): TceResult<HitInput> {
  if (!originAllowed(req.headers.origin, req.headers.host, config)) {
    return err('forbidden', 'page views are accepted from the site origin only');
  }
  const r = new Reader();
  const o = r.object(req.body, '');
  const rawPath = r.string(o.path, 'path', RAW_READ_CAP);
  const ref = r.optionalString(o.ref, 'ref', RAW_READ_CAP);
  if (r.error) return r.done({ path: '', refHost: null, uaClass: 'other', limited: req.limited });
  const path = cleanPath(rawPath);
  if (path === null) return err('bad_request', "must start with '/'", 'path');
  const siteHost = originHost(req.headers.origin ?? '') ?? req.headers.host;
  return ok({ path, refHost: refHost(ref, siteHost), uaClass: uaClass(req.headers.userAgent), limited: req.limited });
}

/** POST /v1/hit. */
export const hitOp: HttpOp<HitInput> = {
  kind: 'http',
  name: 'hit',
  method: 'POST',
  path: '/v1/hit',
  maxBodyBytes: LIMITS.smallBodyBytes,
  // Why degrade: a beacon has no retry and the page must not see errors.
  whenLimited: 'degrade',

  parse(req, ctx) {
    return parseHit(req, ctx.config);
  },

  async run(input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    if (input.limited) return ok({ status: 204 });
    const point: PagePoint = {
      day: utcDay(ctx.clock.now()),
      path: input.path,
      refHost: input.refHost,
      country: ctx.edge.country,
      uaClass: input.uaClass,
    };
    await writePointSafely(ctx.log, 'page', () => ctx.store.writePagePoint(point));
    return ok({ status: 204 });
  },
};
