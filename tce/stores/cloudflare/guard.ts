// Storage guard for D1. A free-plan D1 database stops accepting writes at
// 500 MB, and then every write fails, forget included. So the store stops
// adding rows a little earlier and keeps the remaining room for the calls that
// free space (forget, the retention cron's deletes) and measure it (usage).
//
// D1 reports the database size after every statement (meta.size_after). The
// driver feeds each result's size to the guard; once a size over the limit is
// seen, the guard closes the shared SQL store's ingest gate for a fixed window
// (applyBatch and insertReport answer `unavailable`, the site_daily rollup is
// skipped), and the first row-adding write after the window measures again.

import type { Clock } from '../../core/clock.ts';
import type { Logger } from '../../core/op.ts';
import { CAPACITY } from '../../core/schema/limits.ts';

/**
 * Database size above which new rows are refused: CAPACITY.guardRatio of the
 * free plan's 500 MB (read as the smaller, decimal MB), i.e. 450,000,000. Why
 * 50 MB short of it: room for the writes that are never blocked and for
 * isolates that have not measured yet.
 */
export const STORAGE_LIMIT_BYTES = Math.round(CAPACITY.dbLimitBytes * CAPACITY.guardRatio);

/** How long new rows are refused once the limit is seen, before measuring again. */
export const STORAGE_BLOCK_MS = 10 * 60_000;

/** What the guard remembers between requests. */
export interface StorageGuardState {
  /** Latest database size D1 reported (bytes); null before the first result. */
  sizeBytes: number | null;
  /** New rows are refused while clock.now() < blockedUntil (epoch ms; 0 = never blocked). */
  blockedUntil: number;
}

/** A fresh, unblocked state. */
export function createStorageGuardState(): StorageGuardState {
  return { sizeBytes: null, blockedUntil: 0 };
}

/**
 * The guard state of this Worker isolate, shared by every request it serves.
 *
 * Why module state here, against the "no global mutable state" rule: the
 * store is rebuilt per request, and learning the size anew each time would
 * cost a D1 query per request. The state is a cache of one external fact (the
 * database size) and a deadline: no request data, no identity. It is per
 * isolate, so isolates do not share it and a new isolate starts unblocked;
 * such an isolate learns the size from its first write, which D1 still accepts
 * because the limit sits 50 MB below D1's. The Worker binds one database, so
 * one state is enough.
 */
export const ISOLATE_STORAGE_GUARD: StorageGuardState = createStorageGuardState();

/** Inputs for createStorageGuard. */
export interface StorageGuardOptions {
  state: StorageGuardState;
  clock: Clock;
  /** Gets one error line when a block window starts. */
  log: Logger;
  /** Default STORAGE_LIMIT_BYTES. */
  limitBytes?: number;
  /** Default STORAGE_BLOCK_MS. */
  blockMs?: number;
}

/** Reads sizes from D1 results and says whether new rows are refused. */
export interface StorageGuard {
  /** Record one D1 result's meta; results without a numeric size_after are ignored. */
  observe(meta: { size_after?: unknown } | null | undefined): void;
  /** True while row-adding writes are refused (the SQL store's ingestPaused gate). */
  blocked(): boolean;
}

/** A guard over `state`: a size over the limit starts a block window, logged once. */
export function createStorageGuard(opts: StorageGuardOptions): StorageGuard {
  const limit = opts.limitBytes ?? STORAGE_LIMIT_BYTES;
  const blockMs = opts.blockMs ?? STORAGE_BLOCK_MS;
  const { state, clock, log } = opts;
  return {
    observe(meta) {
      const size = meta?.size_after;
      if (typeof size !== 'number' || !Number.isFinite(size)) return;
      state.sizeBytes = size;
      const now = clock.now();
      // A size seen inside a running window neither extends nor re-logs it.
      if (size > limit && now >= state.blockedUntil) {
        state.blockedUntil = now + blockMs;
        log.error('tce d1: database near its size limit; refusing new rows', {
          sizeBytes: size,
          limitBytes: limit,
          blockedForMs: blockMs,
        });
      }
    },
    blocked() {
      return clock.now() < state.blockedUntil;
    },
  };
}
