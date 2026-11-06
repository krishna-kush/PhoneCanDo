// The calls a SQL backend provides. A backend (node:sqlite, Cloudflare D1,
// anything else that speaks SQLite's dialect) adapts its client to SqlDriver
// and gets the whole Store from createSqlStore().

/** A value a statement binds. Ops already store booleans as 0/1 and JSON as text. */
export type SqlValue = string | number | null;

/** One parameterized statement; each `?` binds the next entry of `params`. */
export interface SqlStatement {
  sql: string;
  params: SqlValue[];
}

/** Minimal async SQL client every SQL store is built on. */
export interface SqlDriver {
  /** Run the statements in ONE transaction (all commit or none do); rows changed per statement, in order. */
  batch(stmts: SqlStatement[]): Promise<{ changes: number }[]>;
  /** Run one read query and return its rows as plain objects keyed by column name. */
  all<T>(sql: string, params: SqlValue[]): Promise<T[]>;
  /**
   * Current database size in bytes, or null when the backend did not say.
   * Why on the driver: each backend measures it its own way (node:sqlite from
   * its page count, D1 from a result's meta.size_after). A driver without it
   * makes Store.usage() report null.
   */
  dbBytes?(): Promise<number | null>;
}
