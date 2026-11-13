// SQLite for tests: an in-memory node:sqlite database with our migrations,
// seen as a SqlDriver (stores/sql) or as a D1 binding (stores/d1, hosts).

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import type { D1Like, D1StatementLike } from '../stores/d1/index.ts';
import type { SqlDriver, SqlValue } from '../stores/sql/driver.ts';

const MIGRATIONS = fileURLToPath(new URL('../stores/sql/migrations/', import.meta.url));

/** A new in-memory database with every migration applied, in order. */
export function openTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const name of readdirSync(MIGRATIONS).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(join(MIGRATIONS, name), 'utf8'));
  }
  return db;
}

/** Runs `run` in one transaction, rolling back on any failure. */
function inTransaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN');
  try {
    const out = run();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

/** A SqlDriver on `db`. */
export function sqliteDriver(db: DatabaseSync): SqlDriver {
  return {
    async batch(stmts) {
      if (stmts.length === 0) return [];
      return inTransaction(db, () => stmts.map((s) => ({ changes: Number(db.prepare(s.sql).run(...s.params).changes) })));
    },
    async all<T>(sql: string, params: SqlValue[]) {
      return db.prepare(sql).all(...params) as T[];
    },
  };
}

/** A bound statement of the fake D1. */
class FakeD1Statement implements D1StatementLike {
  readonly stmt: StatementSync;
  readonly params: SqlValue[];
  constructor(stmt: StatementSync, params: SqlValue[]) {
    this.stmt = stmt;
    this.params = params;
  }
  bind(...values: SqlValue[]): D1StatementLike {
    return new FakeD1Statement(this.stmt, values);
  }
  async all<T>(): Promise<{ results: T[] }> {
    return { results: this.stmt.all(...this.params) as T[] };
  }
}

/** A D1 binding on `db`, enough for stores/d1. */
export function fakeD1(db: DatabaseSync): D1Like {
  return {
    prepare: (sql) => new FakeD1Statement(db.prepare(sql), []),
    async batch(statements) {
      return inTransaction(db, () =>
        statements.map((s) => {
          const f = s as FakeD1Statement;
          return { meta: { changes: Number(f.stmt.run(...f.params).changes) } };
        }),
      );
    },
  };
}
