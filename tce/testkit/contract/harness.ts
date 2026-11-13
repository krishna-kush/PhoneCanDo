// What every contract case runs on: the StoreUnderTest a store's test file
// hands in, a fresh store per case, and readers that see rows only through the
// Store interface (listExpired, listSiteDaily, forget's counts) or, when the
// store has one, through its dump hook.

import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import type { TceResult } from '../../core/result.ts';
import type { ArchivableTable, ForgettableTable, TableName } from '../../core/schema/rows.ts';
import type { BatchCounts, BatchWrite, Store } from '../../core/store.ts';
import { DAY_MS, T0, batchWrite } from '../fixtures.ts';

/** What make() hands the contract. */
export interface StoreUnderTest {
  store: Store;
  close?: () => Promise<void>;
  /** Every row of one table, any order (SQL: `SELECT * FROM <table>`). Enables merged-value checks. */
  dump?: (table: TableName) => Promise<readonly object[]>;
}

/** Optional capabilities of a store's make(). */
export interface StoreContractOptions {
  /** true: make() honours MakeOptions.failingPointSink, so the sink-failure case runs. */
  pointSinkFailure?: boolean;
}

/** How the contract asks make() for a special store. */
export interface MakeOptions {
  /** Build the store with an analytics sink whose every write fails (throws or rejects). */
  failingPointSink?: boolean;
}

/** One row as a plain record. */
export type Row = Record<string, unknown>;
/** Builds a fresh store for one case; a make() that takes no options is fine. */
export type Make = (opts?: MakeOptions) => Promise<StoreUnderTest>;

const PRIMARY_KEYS: Readonly<Record<TableName, readonly string[]>> = {
  devices: ['device_id'],
  installs: ['install_id', 'device_id'],
  sessions: ['session_id'],
  events: ['session_id', 'seq'],
  errors: ['error_id'],
  reports: ['report_id'],
  github_assets_daily: ['day', 'tag', 'asset'],
  github_repo_daily: ['day'],
  site_daily: ['day', 'kind', 'key', 'country'],
  share_links: ['code'],
  share_daily: ['code', 'step', 'day'],
  share_installs: ['device_id'],
};
const TABLES = Object.keys(PRIMARY_KEYS) as TableName[];
/** Later than any fixture row, so listExpired returns everything. */
const FAR = T0 + 3650 * DAY_MS;

/** A plain-object copy, so rows from any driver compare with deepStrictEqual. */
export function plain(row: object): Row {
  return { ...row } as Row;
}

function keyOf(table: TableName, row: Row): string {
  return PRIMARY_KEYS[table].map((k) => String(row[k])).join('\u0000');
}

/** Plain copies of `rows` ordered by the table's primary key. */
export function sorted(table: TableName, rows: readonly object[]): Row[] {
  return rows.map(plain).sort((a, b) => {
    const ka = keyOf(table, a);
    const kb = keyOf(table, b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

/** The value of an ok result; fails the case otherwise. */
export function value<T>(r: TceResult<T>, what: string): T {
  if (!r.ok) assert.fail(`${what} failed: ${r.error.code}: ${r.error.message}`);
  return r.value;
}

/** The error of a failed result; fails the case if it succeeded. */
export function failure<T>(r: TceResult<T>, what: string): { code: string; message: string } {
  if (r.ok) assert.fail(`${what} should have failed`);
  return r.error;
}

/** applyBatch that must succeed; returns its counts. */
export async function apply(store: Store, write: BatchWrite): Promise<BatchCounts> {
  return value(await store.applyBatch(write), 'applyBatch');
}

/** listExpired that must succeed, as plain rows (by default every stored row). */
export async function expired<T extends ArchivableTable>(store: Store, table: T, before = FAR, limit = 1000): Promise<Row[]> {
  return value(await store.listExpired(table, before, limit), `listExpired(${table})`).map(plain);
}

/** Asserts the table holds exactly `rows` (any order); skipped without a dump hook. */
export async function expectRows(s: StoreUnderTest, table: TableName, rows: readonly object[]): Promise<void> {
  if (!s.dump) return;
  assert.deepEqual(sorted(table, await s.dump(table)), sorted(table, rows), `${table} rows`);
}

/** Asserts every table but `except` is empty; skipped without a dump hook. */
export async function expectEmpty(s: StoreUnderTest, except: readonly TableName[] = []): Promise<void> {
  if (!s.dump) return;
  for (const t of TABLES) if (!except.includes(t)) assert.deepEqual(await s.dump(t), [], `${t} should be empty`);
}

/** Every table's rows in key order, or null without a dump hook. */
export async function snapshot(s: StoreUnderTest): Promise<Record<string, Row[]> | null> {
  if (!s.dump) return null;
  const out: Record<string, Row[]> = {};
  for (const t of TABLES) out[t] = sorted(t, await s.dump(t));
  return out;
}

/** A full per-table count record (forget's result shape). */
export function counts(over: Partial<Record<ForgettableTable, number>>): Record<ForgettableTable, number> {
  return {
    devices: 0,
    installs: 0,
    sessions: 0,
    events: 0,
    errors: 0,
    reports: 0,
    share_links: 0,
    share_daily: 0,
    share_installs: 0,
    ...over,
  };
}

/** Skip the rest of a case that needs merged values when the store has no dump hook. */
export function needsDump(s: StoreUnderTest, t: TestContext): boolean {
  if (s.dump) return true;
  t.skip('merged values need a dump hook');
  return false;
}

/** Wraps a case body: a fresh store from make(), closed afterwards. */
export function using(make: Make, fn: (s: StoreUnderTest, t: TestContext) => Promise<void>) {
  return async (t: TestContext): Promise<void> => {
    const s = await make();
    try {
      await fn(s, t);
    } finally {
      await s.close?.();
    }
  };
}

/** A write that only touches the device and install. */
export function identityOnly(over: Partial<BatchWrite>): BatchWrite {
  return batchWrite({ sessions: [], events: [], errors: [], ...over });
}
