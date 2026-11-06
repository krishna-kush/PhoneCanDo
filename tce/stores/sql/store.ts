// The Store (core/store.ts) for every SQLite-dialect backend, written once over
// SqlDriver. Backends differ only in their driver, an optional points sink
// (where page/download analytics points go; Cloudflare: Analytics Engine) and
// an optional ingest gate (Cloudflare: the D1 size guard). Driver failures are
// logged and returned as `unavailable`; nothing throws out of this store.
// Expects every file in migrations/ applied in order.

import { err, ok } from '../../core/result.ts';
import type { TceResult } from '../../core/result.ts';
import type { Logger } from '../../core/op.ts';
import type { BatchCounts, BatchWrite, Store, StoreUsage } from '../../core/store.ts';
import type {
  ArchivableTable,
  ArchiveRowMap,
  DeviceRow,
  DownloadPoint,
  ForgettableTable,
  GithubAssetDailyRow,
  GithubRepoDailyRow,
  PagePoint,
  ReportRow,
  SessionRow,
  SiteDailyRow,
} from '../../core/schema/rows.ts';
import { STATEMENT_LIMITS, buildInserts, buildKeyedDeletes, placeholders, toSqlValue } from './chunk.ts';
import type { SqlDriver, SqlStatement, SqlValue } from './driver.ts';
import { LIST_SITE_DAILY, dayBound, downloadRollup, pageRollup, rollupStatement, siteDailyFrom } from './site.ts';
import {
  DEVICES,
  ERRORS,
  EVENTS,
  GITHUB_ASSETS_DAILY,
  GITHUB_REPO_DAILY,
  INSTALLS,
  REPORTS,
  RETENTION_SPECS,
  SESSIONS,
} from './tables.ts';
import type { RetentionSpec } from './tables.ts';

/** Receives analytics points. Synchronous and fire-and-forget, like Analytics Engine's writeDataPoint. */
export interface PointsSink {
  page(p: PagePoint): void;
  download(p: DownloadPoint): void;
}

/** Optional outputs beyond the SQL tables. */
export interface SqlStoreSinks {
  /** Absent: points only bump the site_daily rollup. */
  points?: PointsSink;
}

/** Optional behaviour a backend adds to the shared store. */
export interface SqlStoreOptions {
  /**
   * Storage gate, asked before every row-adding write. While it returns true,
   * applyBatch and insertReport answer `unavailable` and the site_daily rollup
   * is skipped (the point write still answers ok, and a warning is logged);
   * neither reaches the driver. Deletes, reads and usage() always run: they
   * are how space is freed and measured. usage().ingestPaused reports it.
   * Absent: never paused.
   */
  ingestPaused?: () => boolean;
}

/** Logger that drops everything; hosts pass a real one. */
export const SILENT_LOGGER: Logger = { info() {}, warn() {}, error() {} };

/** Order forget() deletes in: events first, because it finds them through sessions. */
const FORGET_ORDER: readonly ForgettableTable[] = ['events', 'errors', 'reports', 'sessions', 'installs', 'devices'];

/**
 * forget()'s statements for one device, in FORGET_ORDER; each binds the device_id once.
 * Every one is an index lookup (sessions_device, errors_device, reports_device,
 * installs_device, the devices key). Why events only through sessions: events
 * has no device_id index (each index costs a D1 row write per insert), and
 * since applyBatch refuses sessions owned by another device, an event's
 * device_id is always its session's.
 */
export const FORGET_STATEMENTS: Readonly<Record<ForgettableTable, string>> = {
  events: 'DELETE FROM events WHERE session_id IN (SELECT session_id FROM sessions WHERE device_id = ?)',
  errors: 'DELETE FROM errors WHERE device_id = ?',
  reports: 'DELETE FROM reports WHERE device_id = ?',
  sessions: 'DELETE FROM sessions WHERE device_id = ?',
  installs: 'DELETE FROM installs WHERE device_id = ?',
  devices: 'DELETE FROM devices WHERE device_id = ?',
};

/**
 * insertReport's report statement: insert-or-ignore on report_id, and insert
 * nothing when the device is pinned to another verifier. It runs in the same
 * transaction right after the guarded device upsert, which has already pinned
 * (or matched) the verifier, so the condition is a second line of defence:
 * the report row can never land under a foreign verifier, whatever ran before.
 */
function reportInsert(row: ReportRow, verifier: string | null): SqlStatement {
  const cols = REPORTS.columns;
  return {
    sql:
      `INSERT INTO reports (${cols.join(', ')}) SELECT ${cols.map(() => '?').join(', ')} ` +
      // The WHERE also settles SQLite's INSERT ... SELECT ... ON CONFLICT parsing ambiguity.
      'WHERE NOT EXISTS (SELECT 1 FROM devices WHERE device_id = ? AND verifier IS NOT NULL AND verifier IS NOT ?) ' +
      REPORTS.onConflict,
    params: [...cols.map((c) => toSqlValue(row[c], c)), row.device_id, verifier],
  };
}

/** Reports received at or after a time; served by the reports_received index (migration 0002). */
export const COUNT_REPORTS_SINCE = 'SELECT count(*) AS n FROM reports WHERE received >= ?';
/** Reports past retention; served by the reports_received index (migration 0002). */
export const DELETE_REPORTS_BEFORE = 'DELETE FROM reports WHERE received < ?';
/**
 * Oldest kept `received` per retained table, for usage(). Each min() is one
 * lookup on events_received / errors_received (0001) and reports_received (0002).
 */
export const OLDEST_RECEIVED =
  'SELECT (SELECT min(received) FROM events) AS events, (SELECT min(received) FROM errors) AS errors, ' +
  '(SELECT min(received) FROM reports) AS reports';

/** Message (and cause) of a thrown value, for logs. */
function describe(e: unknown): string {
  if (e instanceof Error) {
    const cause = e.cause instanceof Error ? ` (cause: ${e.cause.message})` : '';
    return `${e.name}: ${e.message}${cause}`;
  }
  return String(e);
}

/** Copy exactly `columns` out of a driver row, so extra driver fields never leak into results. */
function pick(raw: Record<string, unknown>, columns: readonly string[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const c of columns) row[c] = raw[c] ?? null;
  return row;
}

/** The retention spec for `table`, or undefined for anything else a caller passed at runtime. */
function retentionSpec(table: string): RetentionSpec | undefined {
  return Object.hasOwn(RETENTION_SPECS, table) ? RETENTION_SPECS[table as ArchivableTable] : undefined;
}

/** What a gated write answers while the storage gate is closed. */
const STORAGE_FULL = 'storage is nearly full; retry later';

/** bad_request unless `t` is a finite number (a time bound that reaches SQL). */
function timeBound(t: unknown, field: string): TceResult<number> {
  return typeof t === 'number' && Number.isFinite(t) ? ok(t) : err('bad_request', `${field} must be a finite number`, field);
}

/** Split `items` into slices of at most `size`. */
function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** One row of the ownership read: the device's pinned verifier, or one stored session's owner. */
interface OwnerRow {
  /** 'device' for the devices row, 'session' for a sessions row. */
  kind: string;
  /** verifier for the device row; device_id for a session row. */
  owner: string | null;
}

/** Build the Store over `driver`. Every write of one call goes into one atomic driver.batch(). */
export function createSqlStore(
  driver: SqlDriver,
  sinks: SqlStoreSinks = {},
  log: Logger = SILENT_LOGGER,
  opts: SqlStoreOptions = {},
): Store {
  const paused = (): boolean => opts.ingestPaused?.() === true;

  /** Run `fn`; a throw (driver, sink or statement builder) becomes a logged `unavailable`. */
  async function guard<T>(op: string, fn: () => Promise<TceResult<T>>): Promise<TceResult<T>> {
    try {
      return await fn();
    } catch (e) {
      log.error(`tce sql store: ${op} failed`, { op, error: describe(e) });
      return err('unavailable', `storage unavailable (${op}); retry later`);
    }
  }

  /** driver.batch() that also checks the driver returned one result per statement. */
  async function runBatch(stmts: SqlStatement[]): Promise<number[]> {
    if (stmts.length === 0) return [];
    const res = await driver.batch(stmts);
    if (!Array.isArray(res) || res.length !== stmts.length) {
      throw new Error(`driver returned ${Array.isArray(res) ? res.length : 'no'} results for ${stmts.length} statements`);
    }
    return res.map((r) => Number(r.changes) || 0);
  }

  /** Sum of changes for statements [from, from + count). */
  const sum = (changes: number[], from: number, count: number): number =>
    changes.slice(from, from + count).reduce((a, b) => a + b, 0);

  /**
   * The ownership rules of Store.applyBatch and Store.insertReport, read before
   * writing: `forbidden` when the device is pinned to another verifier or one
   * of `sessions` already belongs to another device, else null. The device
   * lookup rides in the first session chunk, so a normal batch
   * (≤ LIMITS.sessionsPerBatch) or a report costs one read.
   */
  async function ownershipError(device: DeviceRow, sessions: readonly SessionRow[]): Promise<TceResult<never> | null> {
    const deviceId = device.device_id;
    const sessionIds = [...new Set(sessions.map((r) => r.session_id))];
    // One parameter per chunk goes to the device lookup.
    const slices = sessionIds.length === 0 ? [[]] : chunks(sessionIds, STATEMENT_LIMITS.maxParams - 1);
    const rows: OwnerRow[] = [];
    for (const [i, ids] of slices.entries()) {
      const parts: string[] = [];
      const params: SqlValue[] = [];
      if (i === 0) {
        parts.push("SELECT 'device' AS kind, verifier AS owner FROM devices WHERE device_id = ?");
        params.push(deviceId);
      }
      if (ids.length > 0) {
        parts.push(`SELECT 'session' AS kind, device_id AS owner FROM sessions WHERE session_id IN ${placeholders(ids.length)}`);
        params.push(...ids);
      }
      rows.push(...(await driver.all<OwnerRow>(parts.join(' UNION ALL '), params)));
    }
    for (const r of rows) {
      if (r.kind === 'device' && r.owner !== null && r.owner !== device.verifier) {
        return err('forbidden', 'this device is registered with another verifier');
      }
      if (r.kind === 'session' && r.owner !== deviceId) {
        return err('forbidden', 'a session in this batch belongs to another device');
      }
    }
    return null;
  }

  /**
   * Run one write batch after its ownership check passed. If the batch fails
   * because another writer claimed the device or a session after the check
   * (the ownership guards in tables.ts abort the whole batch), answer
   * `forbidden`; any other failure rethrows the batch's own error (also when
   * the re-check fails too), which guard() turns into `unavailable`.
   */
  async function runOwnedBatch(stmts: SqlStatement[], device: DeviceRow, sessions: readonly SessionRow[]): Promise<TceResult<number[]>> {
    try {
      return ok(await runBatch(stmts));
    } catch (e) {
      const raced = await ownershipError(device, sessions).catch(() => null);
      if (raced) return raced;
      throw e;
    }
  }

  /**
   * A point's two writes (Store.writePagePoint): hand it to the points sink,
   * then add it to the site_daily rollup. A sink failure is logged and never
   * stops the rollup, so the answer is the rollup's: ok when it landed or was
   * skipped by the storage gate, `unavailable` when the driver failed.
   */
  async function writePoint(
    op: string,
    toSink: (sink: PointsSink) => void,
    rollup: () => SiteDailyRow,
  ): Promise<TceResult<void>> {
    if (sinks.points) {
      try {
        toSink(sinks.points);
      } catch (e) {
        log.error(`tce sql store: ${op} analytics sink failed; rollup still written`, { op, error: describe(e) });
      }
    }
    return guard(op, async () => {
      const row = rollup();
      if (paused()) {
        log.warn(`tce sql store: ${op} rollup skipped; storage is nearly full`, { op, day: row.day, kind: row.kind });
        return ok(undefined);
      }
      const stmt = rollupStatement(row);
      if (!stmt.ok) return stmt;
      await runBatch([stmt.value]);
      return ok(undefined);
    });
  }

  return {
    applyBatch(write: BatchWrite): Promise<TceResult<BatchCounts>> {
      if (paused()) return Promise.resolve(err('unavailable', STORAGE_FULL));
      return guard('applyBatch', async () => {
        const denied = await ownershipError(write.device, write.sessions);
        if (denied) return denied;
        const head = [...buildInserts(DEVICES, [write.device]), ...buildInserts(INSTALLS, [write.install])];
        const sessions = buildInserts(SESSIONS, write.sessions);
        const events = buildInserts(EVENTS, write.events);
        const errors = buildInserts(ERRORS, write.errors);
        const ran = await runOwnedBatch([...head, ...sessions, ...events, ...errors], write.device, write.sessions);
        if (!ran.ok) return ran;
        const changes = ran.value;
        let at = head.length;
        const counts: BatchCounts = { sessions: 0, events: 0, errors: 0 };
        counts.sessions = sum(changes, at, sessions.length);
        at += sessions.length;
        counts.events = sum(changes, at, events.length);
        at += events.length;
        counts.errors = sum(changes, at, errors.length);
        return ok(counts);
      });
    },

    insertReport(row: ReportRow, device: DeviceRow): Promise<TceResult<{ inserted: boolean }>> {
      if (paused()) return Promise.resolve(err('unavailable', STORAGE_FULL));
      return guard<{ inserted: boolean }>('insertReport', async () => {
        if (row.device_id !== device.device_id) {
          return err('internal', 'the report and its device row name different devices', 'device_id');
        }
        // The same ownership read and guarded device upsert as applyBatch, then
        // the guarded report insert, all in one transaction: forbidden or
        // failed, nothing of it is written.
        const denied = await ownershipError(device, []);
        if (denied) return denied;
        const stmts = [...buildInserts(DEVICES, [device]), reportInsert(row, device.verifier)];
        const ran = await runOwnedBatch(stmts, device, []);
        if (!ran.ok) return ran;
        // Zero changes on the report statement: a repeated report_id.
        return ok({ inserted: (ran.value[ran.value.length - 1] ?? 0) > 0 });
      });
    },

    countReportsSince(receivedSince: number): Promise<TceResult<number>> {
      const since = timeBound(receivedSince, 'receivedSince');
      if (!since.ok) return Promise.resolve(since);
      return guard('countReportsSince', async () => {
        const rows = await driver.all<{ n: number }>(COUNT_REPORTS_SINCE, [since.value]);
        return ok(Number(rows[0]?.n) || 0);
      });
    },

    deleteExpiredReports(receivedBefore: number): Promise<TceResult<number>> {
      const before = timeBound(receivedBefore, 'receivedBefore');
      if (!before.ok) return Promise.resolve(before);
      return guard('deleteExpiredReports', async () => {
        const changes = await runBatch([{ sql: DELETE_REPORTS_BEFORE, params: [before.value] }]);
        return ok(changes[0] ?? 0);
      });
    },

    forget(deviceId: string, verifier: string): Promise<TceResult<Record<ForgettableTable, number>>> {
      return guard('forget', async () => {
        // `verifier = ?` never matches NULL: a device written before migration
        // 0002 can be forgotten only after its next batch pins a verifier.
        const found = await driver.all<{ one: number }>(
          'SELECT 1 AS one FROM devices WHERE device_id = ? AND verifier = ? LIMIT 1',
          [deviceId, typeof verifier === 'string' ? verifier : null],
        );
        if (found.length === 0) return err('not_found', 'no device with this id and verifier');
        const stmts: SqlStatement[] = FORGET_ORDER.map((table) => ({ sql: FORGET_STATEMENTS[table], params: [deviceId] }));
        const changes = await runBatch(stmts);
        const counts = {} as Record<ForgettableTable, number>;
        FORGET_ORDER.forEach((table, i) => {
          counts[table] = changes[i] ?? 0;
        });
        return ok(counts);
      });
    },

    writePagePoint(point: PagePoint): Promise<TceResult<void>> {
      return writePoint('writePagePoint', (sink) => sink.page(point), () => pageRollup(point));
    },

    writeDownloadPoint(point: DownloadPoint): Promise<TceResult<void>> {
      return writePoint('writeDownloadPoint', (sink) => sink.download(point), () => downloadRollup(point));
    },

    listSiteDaily(fromDay: string, toDay: string): Promise<TceResult<SiteDailyRow[]>> {
      const from = dayBound(fromDay, 'fromDay');
      if (!from.ok) return Promise.resolve(from);
      const to = dayBound(toDay, 'toDay');
      if (!to.ok) return Promise.resolve(to);
      return guard('listSiteDaily', async () => {
        const rows = await driver.all<Record<string, unknown>>(LIST_SITE_DAILY, [from.value, to.value]);
        return ok(rows.map(siteDailyFrom));
      });
    },

    usage(): Promise<TceResult<StoreUsage>> {
      return guard('usage', async () => {
        const bytes = driver.dbBytes ? await driver.dbBytes() : null;
        const [row] = await driver.all<{ events: unknown; errors: unknown; reports: unknown }>(OLDEST_RECEIVED, []);
        const time = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
        // Asked after measuring: a backend whose gate learns the size from the
        // same result (D1) reports the state that size put it in.
        return ok({
          dbBytes: bytes,
          ingestPaused: paused(),
          oldestReceived: { events: time(row?.events), errors: time(row?.errors), reports: time(row?.reports) },
        });
      });
    },

    upsertGithubDaily(assets: GithubAssetDailyRow[], repo: GithubRepoDailyRow | null): Promise<TceResult<void>> {
      return guard('upsertGithubDaily', async () => {
        await runBatch([...buildInserts(GITHUB_ASSETS_DAILY, assets), ...(repo ? buildInserts(GITHUB_REPO_DAILY, [repo]) : [])]);
        return ok(undefined);
      });
    },

    async listExpired<T extends ArchivableTable>(
      table: T,
      receivedBefore: number,
      limit: number,
    ): Promise<TceResult<ArchiveRowMap[T][]>> {
      const spec = retentionSpec(table);
      if (!spec) return err('bad_request', `not an archivable table: ${String(table)}`, 'table');
      const before = timeBound(receivedBefore, 'receivedBefore');
      if (!before.ok) return before;
      const n = Math.floor(limit);
      if (!(n > 0)) return ok([]);
      return guard('listExpired', async () => {
        const rows = await driver.all<Record<string, unknown>>(
          `SELECT ${spec.columns.join(', ')} FROM ${spec.table} WHERE received < ? ORDER BY ${spec.orderBy} LIMIT ?`,
          [before.value, n],
        );
        return ok(rows.map((r) => pick(r, spec.columns)) as unknown as ArchiveRowMap[T][]);
      });
    },

    async deleteRows<T extends ArchivableTable>(table: T, rows: ArchiveRowMap[T][]): Promise<TceResult<number>> {
      const spec = retentionSpec(table);
      if (!spec) return err('bad_request', `not an archivable table: ${String(table)}`, 'table');
      return guard('deleteRows', async () => {
        if (rows.length === 0) return ok(0);
        const keys: SqlValue[][] = rows.map((row) => {
          const r = row as unknown as Record<string, unknown>;
          return spec.key.map((k) => toSqlValue(r[k], k));
        });
        const changes = await runBatch(buildKeyedDeletes(spec.table, spec.key, keys));
        return ok(changes.reduce((a, b) => a + b, 0));
      });
    },
  };
}
