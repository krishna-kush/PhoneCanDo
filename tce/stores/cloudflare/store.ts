// The Store on Cloudflare: rows (and the permanent site_daily rollup) in D1,
// detailed analytics points in Analytics Engine. Built per request from the
// Worker's env bindings; the only thing that outlives a request is the storage
// guard's isolate state (guard.ts says why).

import type { Clock } from '../../core/clock.ts';
import type { Logger } from '../../core/op.ts';
import type { Store } from '../../core/store.ts';
import { createSqlStore } from '../sql/store.ts';
import { createAnalyticsSink } from './analytics.ts';
import { createD1Driver } from './d1.ts';
import { ISOLATE_STORAGE_GUARD, createStorageGuard } from './guard.ts';
import type { StorageGuardState } from './guard.ts';

/** Bindings the store uses (names fixed in hosts/cloudflare/wrangler.jsonc). */
export interface CloudflareStoreEnv {
  /** D1 database `phonecando-stats`. */
  DB: D1Database;
  /** AE dataset `phonecando_pageviews`; absent: page points only bump site_daily. */
  PAGEVIEWS?: AnalyticsEngineDataset;
  /** AE dataset `phonecando_downloads`; absent: download points only bump site_daily. */
  DOWNLOADS?: AnalyticsEngineDataset;
}

/** Overrides for tests; the Worker passes none. */
export interface CloudflareStoreOptions {
  /** Time source of the storage guard. Default: Date.now. */
  clock?: Clock;
  /** Storage guard state. Default: this isolate's ISOLATE_STORAGE_GUARD. */
  guardState?: StorageGuardState;
  /** Database size above which new rows are refused. Default: STORAGE_LIMIT_BYTES. */
  storageLimitBytes?: number;
}

/** Logger on the Workers console (captured by Workers Logs), used when the host passes none. */
export const WORKERS_CONSOLE_LOGGER: Logger = {
  info: (message, data) => console.info(`[tce] ${message}`, data ?? ''),
  warn: (message, data) => console.warn(`[tce] ${message}`, data ?? ''),
  error: (message, data) => console.error(`[tce] ${message}`, data ?? ''),
};

/** Wall clock; stores (unlike core and client) may read real time. */
const SYSTEM_CLOCK: Clock = { now: () => Date.now() };

/**
 * The Cloudflare Store over the given bindings. While the database is near
 * D1's size limit (guard.ts) applyBatch and insertReport answer `unavailable`
 * and the site_daily rollup is skipped; usage() measures the size with one
 * probe query and reports the guard's state as ingestPaused.
 */
export function createCloudflareStore(env: CloudflareStoreEnv, log: Logger = WORKERS_CONSOLE_LOGGER, opts: CloudflareStoreOptions = {}): Store {
  const guard = createStorageGuard({
    state: opts.guardState ?? ISOLATE_STORAGE_GUARD,
    clock: opts.clock ?? SYSTEM_CLOCK,
    log,
    ...(opts.storageLimitBytes === undefined ? {} : { limitBytes: opts.storageLimitBytes }),
  });
  const points = createAnalyticsSink(env.PAGEVIEWS, env.DOWNLOADS);
  return createSqlStore(
    createD1Driver(env.DB, (meta) => guard.observe(meta)),
    points ? { points } : {},
    log,
    { ingestPaused: () => guard.blocked() },
  );
}
