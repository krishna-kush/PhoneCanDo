// The calls a SQL backend provides. A backend that speaks SQLite's dialect
// (Cloudflare D1, node:sqlite in tests) adapts its client to SqlDriver and
// gets the whole store from createSqlStore().

/** A value a statement binds. */
export type SqlValue = string | number | null;

/** One parameterized statement; each `?` binds the next entry of `params`. */
export interface SqlStatement {
  sql: string;
  params: SqlValue[];
}

/** Minimal async SQL client. */
export interface SqlDriver {
  /** Runs the statements in ONE transaction (all commit or none do); rows changed per statement, in order. */
  batch(stmts: SqlStatement[]): Promise<{ changes: number }[]>;
  /** Runs one read query and returns its rows as plain objects keyed by column name. */
  all<T>(sql: string, params: SqlValue[]): Promise<T[]>;
}

/** D1 refuses more bound parameters than this in one statement. */
export const MAX_PARAMS = 100;
