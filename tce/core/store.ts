// The only interface operations use to persist anything. One implementation
// per backend lives in stores/<name>/ and must pass testkit's StoreContract.
// Ops compute fully normalized rows; a store only writes them with the merge
// rules documented on each row type in schema/rows.ts.

import type { TceResult } from './result.ts';
import type {
  ArchivableTable,
  ArchiveRowMap,
  DeviceRow,
  DownloadPoint,
  ErrorRow,
  EventRow,
  ForgettableTable,
  GithubAssetDailyRow,
  GithubRepoDailyRow,
  InstallRow,
  PagePoint,
  ReportRow,
  SessionRow,
  SiteDailyRow,
} from './schema/rows.ts';

/** Everything one batch writes. Applied atomically: all of it or none. */
export interface BatchWrite {
  device: DeviceRow;
  install: InstallRow;
  /** Every session_id referenced by `events` has a row here (the op guarantees it). */
  sessions: SessionRow[];
  events: EventRow[];
  errors: ErrorRow[];
}

/** Rows newly inserted (events, errors) or inserted-or-merged (sessions). */
export interface BatchCounts {
  sessions: number;
  events: number;
  errors: number;
}

/** How an analytics point is written. */
export interface PointOptions {
  /** Add +1 to the permanent site_daily rollup (default true). */
  rollup?: boolean;
}

export interface Store {
  /**
   * Atomic and idempotent: replaying the same write changes nothing.
   * Ownership, checked before anything is written (`forbidden`, nothing written):
   *   - the device row exists with a non-null verifier different from
   *     write.device.verifier (a null stored verifier is filled in);
   *   - any session_id in write.sessions already exists with another device_id.
   * May answer `unavailable` while the backend is near a hard storage limit.
   */
  applyBatch(write: BatchWrite): Promise<TceResult<BatchCounts>>;

  /**
   * Atomically: upsert `device` (same merge and ownership rules as
   * applyBatch, so device.verifier is pinned if the device had no row yet)
   * and insert-or-ignore the report on report_id. `forbidden` (nothing
   * written) when the device row exists with a non-null verifier different
   * from device.verifier. Pinning here is what lets Delete my data find a
   * phone that only ever sent a report. May answer `unavailable` near a
   * storage limit.
   */
  insertReport(row: ReportRow, device: DeviceRow): Promise<TceResult<{ inserted: boolean }>>;

  /** Reports with received >= receivedSince (the op enforces LIMITS.reportsPerDay with it). */
  countReportsSince(receivedSince: number): Promise<TceResult<number>>;

  /** Delete reports with received < receivedBefore (retention); returns how many. */
  deleteExpiredReports(receivedBefore: number): Promise<TceResult<number>>;

  /**
   * If a device row with this device_id and this (non-null) verifier exists,
   * delete every row whose device_id matches (all installs of that device;
   * events through the device's sessions — an index lookup; applyBatch's
   * session-ownership rule guarantees a device's events live only in its own
   * sessions), atomically, and return per-table counts. Otherwise `not_found`.
   */
  forget(deviceId: string, verifier: string): Promise<TceResult<Record<ForgettableTable, number>>>;

  /**
   * Analytics points. Two writes: the detailed point to the analytics sink
   * when the store has one (Cloudflare: Analytics Engine, 3 months), and +1 on
   * the permanent site_daily rollup (SiteDailyRow merge rule). The rollup is
   * subject to the storage guard; an analytics-sink failure never fails it.
   */
  writePagePoint(point: PagePoint): Promise<TceResult<void>>;
  /** `{ rollup: false }` writes only the analytics point: a download not counted in site_daily (download op). */
  writeDownloadPoint(point: DownloadPoint, options?: PointOptions): Promise<TceResult<void>>;

  /** site_daily rows with day in [fromDay, toDay] (YYYY-MM-DD, inclusive). */
  listSiteDaily(fromDay: string, toDay: string): Promise<TceResult<SiteDailyRow[]>>;

  /**
   * Current usage for the limit check: database size in bytes (null when the
   * backend cannot tell) and whether the storage guard is pausing ingest now.
   */
  usage(): Promise<TceResult<StoreUsage>>;

  /** Upsert the day's GitHub counters. */
  upsertGithubDaily(assets: GithubAssetDailyRow[], repo: GithubRepoDailyRow | null): Promise<TceResult<void>>;

  /** Oldest rows with received < receivedBefore, at most `limit`, ordered by received. */
  listExpired<T extends ArchivableTable>(
    table: T,
    receivedBefore: number,
    limit: number,
  ): Promise<TceResult<ArchiveRowMap[T][]>>;

  /** Delete exactly these rows (by primary key); returns how many were deleted. */
  deleteRows<T extends ArchivableTable>(table: T, rows: ArchiveRowMap[T][]): Promise<TceResult<number>>;

}

/** Store.usage() result. */
export interface StoreUsage {
  dbBytes: number | null;
  ingestPaused: boolean;
  /**
   * `received` of the oldest row still kept, per retained table (null when
   * empty). Cheap: each is a min() over the table's received index.
   */
  oldestReceived: { events: number | null; errors: number | null; reports: number | null };
}

export type { EventRow, ErrorRow };
