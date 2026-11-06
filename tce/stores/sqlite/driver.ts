// SqlDriver over node:sqlite. DatabaseSync is synchronous, so a whole batch
// runs inside one JS turn: no other call can interleave with an open
// transaction in this process, and BEGIN IMMEDIATE + busy_timeout serialises
// writers across processes.

import type { DatabaseSync, StatementSync } from 'node:sqlite';
import type { SqlDriver, SqlStatement, SqlValue } from '../sql/driver.ts';

/** Prepared statements kept per connection; generated SQL has few distinct shapes. */
const STATEMENT_CACHE_SIZE = 256;

/** Database size: pages in use times the page size (counts committed WAL pages too). */
const DB_BYTES = 'SELECT page_count * page_size AS bytes FROM pragma_page_count(), pragma_page_size()';

/** A SqlDriver on an open node:sqlite connection. The caller owns (and closes) `db`. */
export function createSqliteDriver(db: DatabaseSync): SqlDriver {
  const cache = new Map<string, StatementSync>();

  /** Prepared statement for `sql`, least-recently-used eviction. */
  const prepare = (sql: string): StatementSync => {
    const hit = cache.get(sql);
    if (hit) {
      cache.delete(sql);
      cache.set(sql, hit);
      return hit;
    }
    const stmt = db.prepare(sql);
    cache.set(sql, stmt);
    if (cache.size > STATEMENT_CACHE_SIZE) {
      const oldest = cache.keys().next();
      if (!oldest.done) cache.delete(oldest.value);
    }
    return stmt;
  };

  return {
    async batch(stmts: SqlStatement[]): Promise<{ changes: number }[]> {
      if (stmts.length === 0) return [];
      // Outside the try: if BEGIN fails there is no transaction of ours to roll back.
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = stmts.map((s) => ({ changes: Number(prepare(s.sql).run(...s.params).changes) }));
        db.exec('COMMIT');
        return out;
      } catch (e) {
        try {
          if (db.isTransaction) db.exec('ROLLBACK');
        } catch {
          // The original error is the one worth reporting.
        }
        throw e;
      }
    },

    async all<T>(sql: string, params: SqlValue[]): Promise<T[]> {
      return prepare(sql).all(...params) as T[];
    },

    async dbBytes(): Promise<number | null> {
      const bytes = Number((prepare(DB_BYTES).get() as { bytes?: unknown } | undefined)?.bytes);
      return Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
    },
  };
}
