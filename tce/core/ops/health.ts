// GET /api/health: public, identity-free capacity facts for the limit check
// that runs on every build (scripts/check-limits.mjs): the database size next
// to the free-plan limit and the ratios from CAPACITY, whether the storage
// guard is pausing ingest, and the retention switch with the age of the oldest
// kept row per table (whole days only). Always 200: a store that cannot report
// its usage answers nulls, so the check can tell "unknown" from "near the limit".

import type { HttpOp, HttpResponse, Logger, RequestCtx } from '../op.ts';
import { ok, type TceResult } from '../result.ts';
import { CAPACITY, RETENTION_DAYS } from '../schema/limits.ts';
import type { HealthResponse } from '../schema/wire.ts';
import type { Store, StoreUsage } from '../store.ts';
import { DAY_MS } from '../time.ts';

/** Usage reported when the store cannot tell. */
const UNKNOWN_USAGE: StoreUsage = {
  dbBytes: null,
  ingestPaused: false,
  oldestReceived: { events: null, errors: null, reports: null },
};

/** Whole days between `received` and `now`, or null when there is no row. */
function ageDays(received: number | null, now: number): number | null {
  return received === null ? null : Math.max(0, Math.floor((now - received) / DAY_MS));
}

/** store.usage(), or UNKNOWN_USAGE when it fails or throws (logged, never propagated). */
export async function usageOrUnknown(store: Store, log: Logger): Promise<StoreUsage> {
  try {
    const r = await store.usage();
    if (r.ok) return r.value;
    log.warn('health: store usage unavailable', { code: r.error.code, message: r.error.message });
  } catch (e) {
    log.error('health: store usage threw', { error: e instanceof Error ? e.message : String(e) });
  }
  return UNKNOWN_USAGE;
}

/** The health body for `usage` at `serverTime`, with the retention switch from config. */
export function healthBody(serverTime: number, usage: StoreUsage, retentionEnabled: boolean): HealthResponse {
  const oldest = usage.oldestReceived;
  return {
    serverTime,
    db: {
      bytes: usage.dbBytes,
      limitBytes: CAPACITY.dbLimitBytes,
      warnRatio: CAPACITY.warnRatio,
      guardRatio: CAPACITY.guardRatio,
    },
    ingestPaused: usage.ingestPaused,
    retention: {
      enabled: retentionEnabled,
      days: { events: RETENTION_DAYS.events, errors: RETENTION_DAYS.errors, reports: RETENTION_DAYS.reports },
      oldestDays: {
        events: ageDays(oldest.events, serverTime),
        errors: ageDays(oldest.errors, serverTime),
        reports: ageDays(oldest.reports, serverTime),
      },
    },
  };
}

/** GET /api/health. */
export const healthOp: HttpOp<null> = {
  kind: 'http',
  name: 'health',
  method: 'GET',
  path: '/api/health',
  maxBodyBytes: 0,
  // whenLimited: default 'reject'. Why: the endpoint writes nothing, so a
  // degraded run would cost the same database read; a caller over the limit gets 429.

  parse() {
    return ok(null);
  },

  async run(_input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    const usage = await usageOrUnknown(ctx.store, ctx.log);
    // no-store: the build's limit check must see the size now, never a cached answer.
    const body = healthBody(ctx.clock.now(), usage, ctx.config.retentionEnabled);
    return ok({ status: 200, json: body, headers: { 'Cache-Control': 'no-store' } });
  },
};
