// SqlDriver over a Cloudflare D1 binding. D1 runs a batch() as one SQL
// transaction (any failure rolls back all of it). The binding is typed by
// shape, so this module needs no Workers types and a real D1Database fits.

import type { SqlDriver, SqlStatement, SqlValue } from '../sql/driver.ts';

/** The part of a D1 prepared statement we use. */
export interface D1StatementLike {
  bind(...values: SqlValue[]): D1StatementLike;
  all<T>(): Promise<{ results: T[] }>;
}

/** The part of a D1Database binding we use. */
export interface D1Like {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<{ meta: { changes: number } }[]>;
}

/** A SqlDriver on `db`. */
export function createD1Driver(db: D1Like): SqlDriver {
  return {
    async batch(stmts: SqlStatement[]) {
      if (stmts.length === 0) return [];
      const results = await db.batch(stmts.map((s) => db.prepare(s.sql).bind(...s.params)));
      return results.map((r) => ({ changes: r.meta.changes }));
    },

    async all<T>(sql: string, params: SqlValue[]): Promise<T[]> {
      const { results } = await db.prepare(sql).bind(...params).all<T>();
      return results;
    },
  };
}
