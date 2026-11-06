// SqlDriver over Cloudflare D1. D1 runs a batch() as one SQL transaction:
// when any statement fails the whole batch rolls back. A batch also counts as a
// single query toward the per-invocation query limit (50 on the free plan).

import type { SqlDriver, SqlStatement, SqlValue } from '../sql/driver.ts';

/** Receives the metadata of every D1 result (the storage guard reads size_after from it). */
export type D1MetaObserver = (meta: D1Meta) => void;

/**
 * The statement dbBytes() runs. D1 has no size query of its own, but every
 * result's meta carries size_after; a constant SELECT reads no rows, so the
 * measurement costs one query and nothing toward the rows-read quota.
 */
export const D1_SIZE_PROBE = 'SELECT 1';

/** A SqlDriver on a D1 binding; `observe` sees each statement's result metadata, the size probe's included. */
export function createD1Driver(db: D1Database, observe?: D1MetaObserver): SqlDriver {
  return {
    async batch(stmts: SqlStatement[]): Promise<{ changes: number }[]> {
      if (stmts.length === 0) return [];
      const results = await db.batch(stmts.map((s) => db.prepare(s.sql).bind(...s.params)));
      if (observe) for (const r of results) observe(r.meta);
      return results.map((r) => ({ changes: r.meta.changes }));
    },

    async all<T>(sql: string, params: SqlValue[]): Promise<T[]> {
      const { results, meta } = await db.prepare(sql).bind(...params).all<T>();
      observe?.(meta);
      return results;
    },

    async dbBytes(): Promise<number | null> {
      const { meta } = await db.prepare(D1_SIZE_PROBE).bind().all();
      observe?.(meta);
      const size: unknown = meta?.size_after;
      return typeof size === 'number' && Number.isFinite(size) && size >= 0 ? size : null;
    },
  };
}
