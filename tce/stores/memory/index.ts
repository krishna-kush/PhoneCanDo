// In-memory Store: the reference semantics for every merge and ownership rule
// documented in core/schema/rows.ts and core/store.ts. Deliberately simple;
// tests read its tables directly. "Newer" means the later server time
// (last_seen for devices and installs, received for sessions); on a tie the
// incoming row counts as newer. A device's verifier is first-write-wins.
// Analytics points are kept in pagePoints/downloadPoints (the detail sink) and
// counted in site_daily (the permanent rollup).

import { err, ok, type TceResult } from '../../core/result.ts';
import { compareSiteDaily, downloadRollup, pageViewRollup } from '../../core/site-daily.ts';
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
  TableName,
} from '../../core/schema/rows.ts';
import type { BatchCounts, BatchWrite, PointOptions, Store, StoreUsage } from '../../core/store.ts';

/** Row type of every table. */
export interface TableRows {
  devices: DeviceRow;
  installs: InstallRow;
  sessions: SessionRow;
  events: EventRow;
  errors: ErrorRow;
  reports: ReportRow;
  github_assets_daily: GithubAssetDailyRow;
  github_repo_daily: GithubRepoDailyRow;
  site_daily: SiteDailyRow;
}

/** Live read-only view: each property returns copies of the table's current rows, in insertion order. */
export type MemoryTables = { readonly [T in TableName]: readonly TableRows[T][] };

/** A Store that also exposes its contents for assertions. */
export interface MemoryStore extends Store {
  readonly tables: MemoryTables;
  readonly pagePoints: readonly PagePoint[];
  readonly downloadPoints: readonly DownloadPoint[];
}

/** Test switches for createMemoryStore. */
export interface MemoryStoreOptions {
  /**
   * The detail sink fails: points are not kept in pagePoints/downloadPoints,
   * while site_daily still counts them and the write still answers ok (a
   * sink failure never fails the rollup, core/store.ts).
   */
  failingPointSink?: boolean;
}

// NOT NULL columns per table, mirroring stores/sql/migrations/, so
// the memory store rejects the same broken rows a SQL store would.
const REQUIRED: { readonly [T in TableName]: readonly (keyof TableRows[T])[] } = {
  devices: ['device_id', 'hw_hash', 'manufacturer', 'model', 'sdk_int', 'abi', 'ram_gb', 'locale', 'tester', 'first_seen', 'last_seen'],
  installs: ['install_id', 'device_id', 'channel', 'first_version', 'last_version', 'last_version_code', 'first_seen', 'last_seen'],
  sessions: ['session_id', 'install_id', 'device_id', 'version', 'version_code', 'channel', 'started', 'received'],
  events: ['session_id', 'seq', 'install_id', 'device_id', 'name', 'ts_client', 'ts', 'received'],
  errors: [
    'error_id',
    'error_key',
    'kind',
    'install_id',
    'device_id',
    'version',
    'class_name',
    'message',
    'frames',
    'ts_client',
    'ts',
    'received',
  ],
  reports: ['report_id', 'install_id', 'device_id', 'version', 'channel', 'events', 'device', 'received'],
  github_assets_daily: ['day', 'tag', 'asset', 'download_count'],
  github_repo_daily: ['day', 'stars', 'forks', 'watchers'],
  site_daily: ['day', 'kind', 'key', 'country', 'count'],
};

const SEP = '\u0000';

/** Primary key of a row as one string. */
const KEY: { readonly [T in TableName]: (row: TableRows[T]) => string } = {
  devices: (r) => r.device_id,
  installs: (r) => r.install_id + SEP + r.device_id,
  sessions: (r) => r.session_id,
  events: (r) => r.session_id + SEP + String(r.seq),
  errors: (r) => r.error_id,
  reports: (r) => r.report_id,
  github_assets_daily: (r) => r.day + SEP + r.tag + SEP + r.asset,
  github_repo_daily: (r) => r.day,
  site_daily: (r) => r.day + SEP + r.kind + SEP + r.key + SEP + r.country,
};

/** The first NOT NULL violation in `row`, or null. */
function missingColumn<T extends TableName>(table: T, row: TableRows[T]): string | null {
  for (const col of REQUIRED[table]) {
    const v = row[col];
    if (v === null || v === undefined) return `${table}.${String(col)}`;
  }
  return null;
}

/**
 * first_seen = min, last_seen = max, other fields from the newer row, drm_id =
 * newest non-null, verifier = the stored one unless it is null (first write
 * wins; applyBatch and insertReport have already refused a write carrying a
 * different one).
 */
export function mergeDevice(stored: DeviceRow, incoming: DeviceRow): DeviceRow {
  const incomingNewer = incoming.last_seen >= stored.last_seen;
  const newer = incomingNewer ? incoming : stored;
  const older = incomingNewer ? stored : incoming;
  return {
    ...newer,
    verifier: stored.verifier ?? incoming.verifier,
    drm_id: newer.drm_id ?? older.drm_id,
    first_seen: Math.min(stored.first_seen, incoming.first_seen),
    last_seen: Math.max(stored.last_seen, incoming.last_seen),
  };
}

/** first_* from the row seen first, last_* and the rest from the row seen last. */
export function mergeInstall(stored: InstallRow, incoming: InstallRow): InstallRow {
  const newer = incoming.last_seen >= stored.last_seen ? incoming : stored;
  const older = incoming.first_seen < stored.first_seen ? incoming : stored;
  return { ...newer, first_version: older.first_version, first_seen: older.first_seen };
}

/**
 * started = min, ended = max non-null, nullable fields = newest non-null,
 * received = max. install_id, device_id and the build the session ran
 * (version, version_code, channel) never change once stored.
 */
export function mergeSession(stored: SessionRow, incoming: SessionRow): SessionRow {
  const incomingNewer = incoming.received >= stored.received;
  const n = incomingNewer ? incoming : stored;
  const o = incomingNewer ? stored : incoming;
  const ended = n.ended === null ? o.ended : o.ended === null ? n.ended : Math.max(n.ended, o.ended);
  return {
    ...n,
    // Why: a resend that names another install or device (forged or buggy)
    // must not move an existing session, or forget() would miss or over-delete it.
    install_id: stored.install_id,
    device_id: stored.device_id,
    // Why: a later batch from an updated app (e.g. a minimal row made for
    // events) must not re-attribute the session to the newer build.
    version: stored.version,
    version_code: stored.version_code,
    channel: stored.channel,
    started: Math.min(n.started, o.started),
    ended,
    boot_ms: n.boot_ms ?? o.boot_ms,
    engine_ok: n.engine_ok ?? o.engine_ok,
    engine_exit_code: n.engine_exit_code ?? o.engine_exit_code,
    engine_stderr_tail: n.engine_stderr_tail ?? o.engine_stderr_tail,
    low_memory_trims: n.low_memory_trims ?? o.low_memory_trims,
    battery_opt_ignored: n.battery_opt_ignored ?? o.battery_opt_ignored,
    fg_service_ok: n.fg_service_ok ?? o.fg_service_ok,
    a11y_on: n.a11y_on ?? o.a11y_on,
    counters: n.counters ?? o.counters,
    country: n.country ?? o.country,
    received: Math.max(n.received, o.received),
  };
}

/** A fresh, empty in-memory store. */
export function createMemoryStore(opts: MemoryStoreOptions = {}): MemoryStore {
  const data: { [T in TableName]: Map<string, TableRows[T]> } = {
    devices: new Map(),
    installs: new Map(),
    sessions: new Map(),
    events: new Map(),
    errors: new Map(),
    reports: new Map(),
    github_assets_daily: new Map(),
    github_repo_daily: new Map(),
    site_daily: new Map(),
  };
  const pagePoints: PagePoint[] = [];
  const downloadPoints: DownloadPoint[] = [];

  const copies = <T extends TableName>(table: T): TableRows[T][] => [...data[table].values()].map((r) => ({ ...r }));

  /** Store a copy under its key. */
  const put = <T extends TableName>(table: T, row: TableRows[T]): void => {
    data[table].set(KEY[table](row), { ...row });
  };

  /** Insert unless the key exists; true when inserted. */
  const insertOrIgnore = <T extends TableName>(table: T, row: TableRows[T]): boolean => {
    if (data[table].has(KEY[table](row))) return false;
    put(table, row);
    return true;
  };

  const upsert = <T extends 'devices' | 'installs' | 'sessions'>(
    table: T,
    row: TableRows[T],
    merge: (stored: TableRows[T], incoming: TableRows[T]) => TableRows[T],
  ): void => {
    const stored = data[table].get(KEY[table](row));
    put(table, stored ? merge(stored, row) : row);
  };

  /**
   * One analytics point: validate its rollup row first (nothing is written
   * when it breaks a NOT NULL column), keep the detail unless the sink is
   * failing, then add the row's count to site_daily.
   */
  const writePoint = <P>(point: P, rollup: SiteDailyRow, detail: P[], counted = true): TceResult<void> => {
    const bad = missingColumn('site_daily', rollup);
    if (bad !== null) return err('internal', `memory store: ${bad} must not be null`, bad);
    if (!opts.failingPointSink) detail.push({ ...point });
    if (!counted) return ok(undefined);
    const stored = data.site_daily.get(KEY.site_daily(rollup));
    put('site_daily', stored ? { ...stored, count: stored.count + rollup.count } : rollup);
    return ok(undefined);
  };

  /** Delete every row matching `pred`; returns how many. */
  const deleteWhere = <T extends TableName>(table: T, pred: (row: TableRows[T]) => boolean): number => {
    let n = 0;
    for (const [k, row] of data[table]) {
      if (pred(row)) {
        data[table].delete(k);
        n++;
      }
    }
    return n;
  };

  /**
   * applyBatch's and insertReport's device rule: `forbidden` when the stored
   * device is pinned to another verifier (a null stored verifier is filled in
   * by the merge, not a conflict), else null.
   */
  const deviceForbidden = (incoming: DeviceRow): TceResult<never> | null => {
    const stored = data.devices.get(incoming.device_id);
    if (stored && stored.verifier !== null && stored.verifier !== incoming.verifier) {
      return err('forbidden', 'the device verifier does not match');
    }
    return null;
  };

  const tables = {} as MemoryTables;
  for (const t of Object.keys(data) as TableName[]) {
    Object.defineProperty(tables, t, { enumerable: true, get: () => copies(t) });
  }

  return {
    tables,
    pagePoints,
    downloadPoints,

    async applyBatch(write: BatchWrite): Promise<TceResult<BatchCounts>> {
      // Validate everything before touching anything: once validation passes
      // nothing below can fail, which makes the write atomic.
      const bad =
        missingColumn('devices', write.device) ??
        missingColumn('installs', write.install) ??
        write.sessions.map((r) => missingColumn('sessions', r)).find((m) => m !== null) ??
        write.events.map((r) => missingColumn('events', r)).find((m) => m !== null) ??
        write.errors.map((r) => missingColumn('errors', r)).find((m) => m !== null) ??
        null;
      if (bad !== null) return err('internal', `memory store: ${bad} must not be null`, bad);

      // Ownership, before anything is written (core/store.ts).
      const denied = deviceForbidden(write.device);
      if (denied) return denied;
      for (const s of write.sessions) {
        const stored = data.sessions.get(s.session_id);
        if (stored && stored.device_id !== write.device.device_id) {
          return err('forbidden', 'a session belongs to another device', 'sessions');
        }
      }

      upsert('devices', write.device, mergeDevice);
      upsert('installs', write.install, mergeInstall);
      for (const s of write.sessions) upsert('sessions', s, mergeSession);
      let events = 0;
      for (const e of write.events) if (insertOrIgnore('events', e)) events++;
      let errors = 0;
      for (const e of write.errors) if (insertOrIgnore('errors', e)) errors++;
      return ok({ sessions: write.sessions.length, events, errors });
    },

    async insertReport(row: ReportRow, device: DeviceRow): Promise<TceResult<{ inserted: boolean }>> {
      // Validate everything first, as applyBatch does: nothing below can fail.
      const bad = missingColumn('reports', row) ?? missingColumn('devices', device);
      if (bad !== null) return err('internal', `memory store: ${bad} must not be null`, bad);
      if (row.device_id !== device.device_id) {
        return err('internal', 'memory store: the report and its device row name different devices', 'device_id');
      }
      // The same ownership rule and device merge as applyBatch (core/store.ts).
      const denied = deviceForbidden(device);
      if (denied) return denied;
      upsert('devices', device, mergeDevice);
      return ok({ inserted: insertOrIgnore('reports', row) });
    },

    async countReportsSince(receivedSince: number): Promise<TceResult<number>> {
      let n = 0;
      for (const r of data.reports.values()) if (r.received >= receivedSince) n++;
      return ok(n);
    },

    async deleteExpiredReports(receivedBefore: number): Promise<TceResult<number>> {
      return ok(deleteWhere('reports', (r) => r.received < receivedBefore));
    },

    async forget(deviceId: string, verifier: string): Promise<TceResult<Record<ForgettableTable, number>>> {
      const device = data.devices.get(deviceId);
      // A null stored verifier (a row from before migration 0002) matches nothing.
      if (!device || device.verifier === null || device.verifier !== verifier) {
        return err('not_found', 'no device with this id and verifier');
      }
      const sessionIds = new Set<string>();
      for (const s of data.sessions.values()) if (s.device_id === deviceId) sessionIds.add(s.session_id);
      return ok({
        devices: deleteWhere('devices', (r) => r.device_id === deviceId),
        installs: deleteWhere('installs', (r) => r.device_id === deviceId),
        sessions: deleteWhere('sessions', (r) => r.device_id === deviceId),
        events: deleteWhere('events', (r) => r.device_id === deviceId || sessionIds.has(r.session_id)),
        errors: deleteWhere('errors', (r) => r.device_id === deviceId),
        reports: deleteWhere('reports', (r) => r.device_id === deviceId),
      });
    },

    async writePagePoint(point: PagePoint): Promise<TceResult<void>> {
      return writePoint(point, pageViewRollup(point), pagePoints);
    },

    async writeDownloadPoint(point: DownloadPoint, options: PointOptions = {}): Promise<TceResult<void>> {
      return writePoint(point, downloadRollup(point), downloadPoints, options.rollup !== false);
    },

    async listSiteDaily(fromDay: string, toDay: string): Promise<TceResult<SiteDailyRow[]>> {
      // YYYY-MM-DD compares as text in calendar order.
      return ok(copies('site_daily').filter((r) => r.day >= fromDay && r.day <= toDay).sort(compareSiteDaily));
    },

    async usage(): Promise<TceResult<StoreUsage>> {
      // Why dbBytes null: an in-memory map has no database file to measure, and no storage guard.
      const oldest = (table: 'events' | 'errors' | 'reports'): number | null => {
        let min: number | null = null;
        for (const row of data[table].values()) if (min === null || row.received < min) min = row.received;
        return min;
      };
      return ok({
        dbBytes: null,
        ingestPaused: false,
        oldestReceived: { events: oldest('events'), errors: oldest('errors'), reports: oldest('reports') },
      });
    },

    async upsertGithubDaily(assets: GithubAssetDailyRow[], repo: GithubRepoDailyRow | null): Promise<TceResult<void>> {
      const bad =
        assets.map((r) => missingColumn('github_assets_daily', r)).find((m) => m !== null) ??
        (repo ? missingColumn('github_repo_daily', repo) : null);
      if (bad != null) return err('internal', `memory store: ${bad} must not be null`, bad);
      for (const a of assets) put('github_assets_daily', a);
      if (repo) put('github_repo_daily', repo);
      return ok(undefined);
    },

    async listExpired<T extends ArchivableTable>(
      table: T,
      receivedBefore: number,
      limit: number,
    ): Promise<TceResult<ArchiveRowMap[T][]>> {
      // TypeScript cannot narrow a generic table name; both maps hold ArchiveRowMap[T] for their T.
      const rows = [...(data[table] as Map<string, ArchiveRowMap[T]>).values()];
      const key = KEY[table] as (row: ArchiveRowMap[T]) => string;
      const out = rows
        .filter((r) => r.received < receivedBefore)
        .sort((a, b) => a.received - b.received || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
        .slice(0, Math.max(0, limit))
        .map((r) => ({ ...r }));
      return ok(out);
    },

    async deleteRows<T extends ArchivableTable>(table: T, rows: ArchiveRowMap[T][]): Promise<TceResult<number>> {
      const map = data[table] as Map<string, ArchiveRowMap[T]>;
      const key = KEY[table] as (row: ArchiveRowMap[T]) => string;
      let n = 0;
      for (const r of rows) if (map.delete(key(r))) n++;
      return ok(n);
    },
  };
}
