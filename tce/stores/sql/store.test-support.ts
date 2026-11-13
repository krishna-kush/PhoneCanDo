// What the store-*.test.ts files share: the shared SQL store over a fresh
// in-memory node:sqlite database per test, behind a driver wrapper that
// records every statement, with a logger that keeps its entries; plus the
// verifier fixtures and small row readers. Test-only: nothing in stores/sql
// imports it.

import assert from 'node:assert/strict';
import { afterEach, beforeEach } from 'node:test';
import type { DatabaseSync } from 'node:sqlite';
import type { Logger } from '../../core/op.ts';
import type { DeviceRow, ForgettableTable } from '../../core/schema/rows.ts';
import type { BatchWrite } from '../../core/store.ts';
import type { SqlDriver, SqlStatement } from './driver.ts';
import { createSqlStore } from './store.ts';
import type { SqlStoreOptions, SqlStoreSinks } from './store.ts';
import { openSqliteDatabase } from '../sqlite/store.ts';
import type { SqliteDatabase } from '../sqlite/store.ts';
import { batchWrite, deviceRow } from '../../testkit/fixtures.ts';

/** Verifiers (shape of SHA-256 hex) for the two fixture devices, and an impostor's. */
export const V1 = '0a'.repeat(32);
export const V2 = '0b'.repeat(32);
export const V_BAD = '0c'.repeat(32);

/** batchWrite() whose device row carries `verifier` (and `device` overrides). */
export function as(verifier: string | null, over: Partial<BatchWrite> = {}, device: Partial<DeviceRow> = {}): BatchWrite {
  return batchWrite({ ...over, device: deviceRow({ ...over.device, ...device, verifier }) });
}

/** The fixture device row pinned to `verifier` (what the report op hands insertReport). */
export function dev(verifier: string | null, over: Partial<DeviceRow> = {}): DeviceRow {
  return deviceRow({ ...over, verifier });
}

/** A full per-table count record (forget's result shape). */
export function counts(over: Partial<Record<ForgettableTable, number>>): Record<ForgettableTable, number> {
  return {
    events: 0,
    errors: 0,
    reports: 0,
    share_daily: 0,
    share_installs: 0,
    share_links: 0,
    sessions: 0,
    installs: 0,
    devices: 0,
    ...over,
  };
}

/** What the recording wrapper saw. */
interface Recording {
  driver: SqlDriver;
  batches: SqlStatement[][];
  reads: SqlStatement[];
  /** dbBytes() calls. */
  sizes: number;
}

/** Driver wrapper recording every batch(), all() and dbBytes() call. */
function recording(inner: SqlDriver): Recording {
  const out: Recording = { driver: inner, batches: [], reads: [], sizes: 0 };
  out.driver = {
    batch(stmts) {
      out.batches.push(stmts);
      return inner.batch(stmts);
    },
    all<T>(sql: string, params: SqlStatement['params']) {
      out.reads.push({ sql, params });
      return inner.all<T>(sql, params);
    },
    dbBytes() {
      out.sizes++;
      return inner.dbBytes ? inner.dbBytes() : Promise.resolve(null);
    },
  };
  return out;
}

/** Logger that keeps what it was told. */
function memoryLog(): Logger & { entries: { level: string; message: string; data?: Record<string, unknown> }[] } {
  const entries: { level: string; message: string; data?: Record<string, unknown> }[] = [];
  const at = (level: string) => (message: string, data?: Record<string, unknown>) => {
    entries.push(data === undefined ? { level, message } : { level, message, data });
  };
  return { entries, info: at('info'), warn: at('warn'), error: at('error') };
}

/** Value of `SELECT count(*)` for a table. */
export function count(db: DatabaseSync, table: string): number {
  return (db.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n;
}

/** One row by primary key predicate, as a plain object. */
export function row(db: DatabaseSync, sql: string, ...params: (string | number)[]): Record<string, unknown> {
  const r = db.prepare(sql).get(...params);
  assert.ok(r, `no row for ${sql}`);
  return { ...r };
}

/** The current test's database (every migration applied). */
export let h: SqliteDatabase;
/** The current test's recording wrapper around `h.driver`. */
export let rec: Recording;
/** The current test's logger. */
export let log: ReturnType<typeof memoryLog>;

/** Give every test of the calling file a fresh `h`, `rec` and `log`, and close `h` afterwards. */
export function freshDatabasePerTest(): void {
  beforeEach(() => {
    h = openSqliteDatabase(':memory:');
    rec = recording(h.driver);
    log = memoryLog();
  });
  afterEach(() => h.close());
}

/** The SQL store under test: the recording driver, the given sinks and options, the test's logger. */
export const store = (sinks: SqlStoreSinks = {}, opts: SqlStoreOptions = {}) => createSqlStore(rec.driver, sinks, log, opts);
