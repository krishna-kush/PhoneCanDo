// The Store on node:sqlite: local development and the own-server host.
// One connection per store; the schema is migrated when it opens.

import { DatabaseSync } from 'node:sqlite';
import type { Clock } from '../../core/clock.ts';
import type { Logger } from '../../core/op.ts';
import type { Store } from '../../core/store.ts';
import type { SqlDriver } from '../sql/driver.ts';
import { createSqlStore } from '../sql/store.ts';
import { createSqliteDriver } from './driver.ts';
import { applyMigrations, defaultMigrations } from './migrate.ts';
import type { Migration } from './migrate.ts';
import { createTablePointsSink } from './sinks.ts';

/** Options for opening a node:sqlite database. */
export interface SqliteOpenOptions {
  /** Time source for migration records and point timestamps. Default: Date.now. */
  clock?: Clock;
  /** Migrations to apply. Default: shared + sqlite-local (defaultMigrations()). */
  migrations?: readonly Migration[];
}

/** Options for createSqliteStore. */
export interface SqliteStoreOptions extends SqliteOpenOptions {
  /** Where driver failures are logged. Default: console. */
  log?: Logger;
}

/** An open, migrated database and its driver. */
export interface SqliteDatabase {
  db: DatabaseSync;
  driver: SqlDriver;
  /** Migration names applied by this open (empty when the schema was current). */
  applied: string[];
  /** Close the connection; safe to call twice. */
  close(): void;
}

/** A store and the handle that closes its connection. */
export interface SqliteStore {
  store: Store;
  /** Raw SQL on the same connection, for host tools and tests. Writes through it bypass the Store's merge rules. */
  driver: SqlDriver;
  /** Close the connection; safe to call twice. Calls after close return `unavailable`. */
  close(): Promise<void>;
}

/** Wall-clock default; stores (unlike core and client) may read real time. */
const SYSTEM_CLOCK: Clock = { now: () => Date.now() };

/** Logger writing to the process console, used when the host passes none. */
export const CONSOLE_LOGGER: Logger = {
  info: (message, data) => console.info(`[tce] ${message}`, data ?? ''),
  warn: (message, data) => console.warn(`[tce] ${message}`, data ?? ''),
  error: (message, data) => console.error(`[tce] ${message}`, data ?? ''),
};

/** True for paths SQLite opens in memory (WAL does not apply there). */
function isMemoryPath(path: string): boolean {
  return path === ':memory:' || path === '' || /^file:.*[?&]mode=memory\b/.test(path);
}

/**
 * Open `path` (a file, or `':memory:'`), set pragmas and apply pending
 * migrations. Throws when the database cannot be opened or a migration fails:
 * a host cannot serve without its schema, so it must fail at startup.
 */
export function openSqliteDatabase(path: string, opts: SqliteOpenOptions = {}): SqliteDatabase {
  const db = new DatabaseSync(path);
  let applied: string[];
  try {
    // Wait for another writer instead of failing at once with SQLITE_BUSY.
    db.exec('PRAGMA busy_timeout = 5000');
    if (!isMemoryPath(path)) {
      // WAL lets readers run during a write; NORMAL sync is durable across
      // process crashes, which is the right trade for telemetry rows.
      db.exec('PRAGMA journal_mode = WAL');
      db.exec('PRAGMA synchronous = NORMAL');
    }
    applied = applyMigrations(db, opts.migrations ?? defaultMigrations(), opts.clock ?? SYSTEM_CLOCK);
  } catch (e) {
    db.close();
    throw e;
  }
  let open = true;
  return {
    db,
    driver: createSqliteDriver(db),
    applied,
    close(): void {
      if (!open) return;
      open = false;
      db.close();
    },
  };
}

/**
 * The node:sqlite Store at `path`, with the local point tables. It has no
 * storage gate: usage() reports the file size and never a paused ingest.
 */
export function createSqliteStore(path: string, opts: SqliteStoreOptions = {}): SqliteStore {
  const handle = openSqliteDatabase(path, opts);
  const store = createSqlStore(
    handle.driver,
    { points: createTablePointsSink(handle.db, opts.clock ?? SYSTEM_CLOCK) },
    opts.log ?? CONSOLE_LOGGER,
  );
  return {
    store,
    driver: handle.driver,
    async close(): Promise<void> {
      handle.close();
    },
  };
}
