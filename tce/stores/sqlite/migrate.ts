// Migration runner for node:sqlite. Applies the shared SQL migrations
// (stores/sql/migrations) and then this store's own (stores/sqlite/migrations),
// each in file-name order, each in its own transaction, and records it in
// `_tce_migrations` so a restart applies only what is new.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import type { Clock } from '../../core/clock.ts';

/** One migration file. */
export interface Migration {
  /** Recorded name: the file name, prefixed for store-local migrations (e.g. `sqlite/0001_points.sql`). */
  name: string;
  sql: string;
}

/** Shared schema every SQL store applies. */
export const SHARED_MIGRATIONS_DIR = new URL('../sql/migrations/', import.meta.url);
/** Tables only the node:sqlite store has (local analytics points). */
export const SQLITE_MIGRATIONS_DIR = new URL('./migrations/', import.meta.url);

const MIGRATION_FILE = /^\d{4}_[A-Za-z0-9_]+\.sql$/;

/** Read `NNNN_name.sql` files from `dir`, sorted by name; `prefix` namespaces their recorded names. */
export function loadMigrations(dir: URL | string, prefix = ''): Migration[] {
  return readdirSync(dir)
    .filter((f) => MIGRATION_FILE.test(f))
    .sort()
    .map((f) => ({ name: prefix + f, sql: readFileSync(new URL(f, dirUrl(dir)), 'utf8') }));
}

/** `dir` as a directory URL (trailing slash), so relative file URLs resolve inside it. */
function dirUrl(dir: URL | string): URL {
  if (typeof dir === 'string') return pathToFileURL(resolve(dir) + sep);
  return dir.href.endsWith('/') ? dir : new URL(`${dir.href}/`);
}

/** Every migration this store runs, in order: shared first, then sqlite-local. */
export function defaultMigrations(): Migration[] {
  return [...loadMigrations(SHARED_MIGRATIONS_DIR), ...loadMigrations(SQLITE_MIGRATIONS_DIR, 'sqlite/')];
}

/**
 * Apply every migration not yet recorded; returns the names applied now.
 * Throws (after rolling back that migration) when one fails: a store whose
 * schema is behind cannot serve, so the host must not start.
 */
export function applyMigrations(db: DatabaseSync, migrations: readonly Migration[], clock: Clock): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS _tce_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL) WITHOUT ROWID');
  const done = new Set(
    (db.prepare('SELECT name FROM _tce_migrations').all() as { name: string }[]).map((r) => r.name),
  );
  const applied: string[] = [];
  for (const m of migrations) {
    if (done.has(m.name)) continue;
    db.exec('BEGIN IMMEDIATE');
    try {
      // Re-check inside the write lock: another process may have applied it meanwhile.
      if (db.prepare('SELECT 1 FROM _tce_migrations WHERE name = ?').get(m.name) === undefined) {
        db.exec(m.sql);
        db.prepare('INSERT INTO _tce_migrations (name, applied_at) VALUES (?, ?)').run(m.name, clock.now());
        applied.push(m.name);
      }
      db.exec('COMMIT');
    } catch (e) {
      try {
        if (db.isTransaction) db.exec('ROLLBACK');
      } catch {
        // Report the migration error, not the rollback's.
      }
      throw new Error(`tce sqlite: migration ${m.name} failed: ${e instanceof Error ? e.message : String(e)}`, { cause: e });
    }
  }
  return applied;
}
