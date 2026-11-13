// One TableSpec per table in migrations/ (0001_init.sql plus the later additive
// columns and tables). The conflict clauses ARE the merge rules documented on
// each row type in core/schema/rows.ts.
//
// SQLite evaluates every right-hand side of `DO UPDATE SET` against the row as
// it was before the update, so `last_seen = max(...)` and a later
// `CASE WHEN excluded.last_seen >= devices.last_seen` both see the old value.
// Ties go to the incoming row (`>=`): replaying a row then rewrites identical
// values, which keeps every merge idempotent.
//
// Ownership guards (devices, sessions): the store checks ownership with a read
// before it writes (Store.applyBatch, and Store.insertReport for the device),
// but on D1 another request can commit between that read and the write batch.
// So the upserts also refuse a row that belongs to someone else: they set a
// NOT NULL column to NULL, the statement fails, and the whole batch rolls
// back. A stored row is never re-owned, even in a race; the store then
// re-checks and answers `forbidden`.

import type { TableSpec } from './chunk.ts';
import type {
  DeviceRow,
  ErrorRow,
  EventRow,
  GithubAssetDailyRow,
  GithubRepoDailyRow,
  InstallRow,
  ReportRow,
  SessionRow,
  ShareDailyRow,
  ShareInstallRow,
  ShareLinkRow,
  SiteDailyRow,
} from '../../core/schema/rows.ts';

/** Resolves to `unknown` when C lists every key of R, else to an object naming the missing ones. */
type Complete<R, C extends readonly unknown[]> = [Exclude<keyof R, C[number]>] extends [never]
  ? unknown
  : { readonly missingColumns: Exclude<keyof R, C[number]> };

/** Column list of R that fails to type-check when a column of R is left out. */
function columnsOf<R>() {
  return <const C extends readonly (keyof R & string)[]>(cols: C & Complete<R, C>): C => cols;
}

/** `col = CASE WHEN <newer> THEN excluded.col ELSE <table>.col END` for each column. */
function fromNewer(table: string, newer: string, cols: readonly string[]): string[] {
  return cols.map((c) => `${c} = CASE WHEN ${newer} THEN excluded.${c} ELSE ${table}.${c} END`);
}

/** Newest non-null wins: the newer row's value unless it is null, else the older row's. */
function newestNonNull(table: string, newer: string, cols: readonly string[]): string[] {
  return cols.map(
    (c) => `${c} = CASE WHEN ${newer} THEN coalesce(excluded.${c}, ${table}.${c}) ELSE coalesce(${table}.${c}, excluded.${c}) END`,
  );
}

/**
 * `col = <value>` for a NOT NULL column, except that it becomes NULL when
 * `foreign` holds: the statement then fails and the batch rolls back (see the header).
 */
function unlessForeign(foreign: string, col: string, value: string): string {
  return `${col} = CASE WHEN ${foreign} THEN NULL ELSE ${value} END`;
}

const DEVICE_COLUMNS = columnsOf<DeviceRow>()([
  'device_id',
  'verifier',
  'hw_hash',
  'drm_id',
  'manufacturer',
  'model',
  'sdk_int',
  'abi',
  'ram_gb',
  'locale',
  'country',
  'asn',
  'tester',
  'first_seen',
  'last_seen',
]);
const DEVICE_NEWER = 'excluded.last_seen >= devices.last_seen';
/** The stored device is pinned to another verifier (a null stored verifier is not a conflict). */
const DEVICE_FOREIGN = 'devices.verifier IS NOT NULL AND devices.verifier IS NOT excluded.verifier';

/**
 * devices: first_seen = min, last_seen = max, descriptive fields from the row
 * with the newer last_seen, drm_id = newest non-null, verifier = first non-null
 * ever written (never replaced). A row carrying another verifier than the
 * pinned one fails the statement (ownership guard).
 */
export const DEVICES: TableSpec<DeviceRow> = {
  table: 'devices',
  columns: DEVICE_COLUMNS,
  onConflict: `ON CONFLICT (device_id) DO UPDATE SET ${[
    unlessForeign(DEVICE_FOREIGN, 'hw_hash', `CASE WHEN ${DEVICE_NEWER} THEN excluded.hw_hash ELSE devices.hw_hash END`),
    // Why coalesce and not newer-wins: the first verifier pins the device;
    // only a row written before migration 0002 (null) is filled in.
    'verifier = coalesce(devices.verifier, excluded.verifier)',
    ...fromNewer('devices', DEVICE_NEWER, [
      'manufacturer',
      'model',
      'sdk_int',
      'abi',
      'ram_gb',
      'locale',
      'country',
      'asn',
      'tester',
    ]),
    // Why newest-by-last_seen and not arrival order: an older batch replayed
    // late must not clobber the id a newer one reported.
    ...newestNonNull('devices', DEVICE_NEWER, ['drm_id']),
    'first_seen = min(devices.first_seen, excluded.first_seen)',
    'last_seen = max(devices.last_seen, excluded.last_seen)',
  ].join(', ')}`,
};

const INSTALL_COLUMNS = columnsOf<InstallRow>()([
  'install_id',
  'device_id',
  'channel',
  'install_source',
  'first_version',
  'last_version',
  'last_version_code',
  'first_seen',
  'last_seen',
]);

/** installs: first_version/first_seen from the older row; channel, install_source and last_* from the newer. */
export const INSTALLS: TableSpec<InstallRow> = {
  table: 'installs',
  columns: INSTALL_COLUMNS,
  onConflict: `ON CONFLICT (install_id, device_id) DO UPDATE SET ${[
    'first_version = CASE WHEN excluded.first_seen < installs.first_seen THEN excluded.first_version ELSE installs.first_version END',
    'first_seen = min(installs.first_seen, excluded.first_seen)',
    ...fromNewer('installs', 'excluded.last_seen >= installs.last_seen', [
      'channel',
      'install_source',
      'last_version',
      'last_version_code',
    ]),
    'last_seen = max(installs.last_seen, excluded.last_seen)',
  ].join(', ')}`,
};

const SESSION_COLUMNS = columnsOf<SessionRow>()([
  'session_id',
  'install_id',
  'device_id',
  'version',
  'version_code',
  'channel',
  'started',
  'ended',
  'boot_ms',
  'engine_ok',
  'engine_exit_code',
  'engine_stderr_tail',
  'low_memory_trims',
  'battery_opt_ignored',
  'fg_service_ok',
  'a11y_on',
  'counters',
  'country',
  'received',
]);
const SESSION_NEWER = 'excluded.received >= sessions.received';
/** The stored session belongs to another device. */
const SESSION_FOREIGN = 'sessions.device_id IS NOT excluded.device_id';

/**
 * sessions: started = min, ended = max non-null, every other nullable column
 * keeps the newest non-null value (newest by `received`; counters JSON is
 * replaced whole, never merged), received = max. Never rewritten, first write
 * wins: install_id/device_id (a session belongs to the device that first
 * reported it; a row for it from another device fails the statement, the
 * ownership guard) and the build it ran (version, version_code, channel), so a
 * later batch from an updated app cannot re-attribute an old session.
 */
export const SESSIONS: TableSpec<SessionRow> = {
  table: 'sessions',
  columns: SESSION_COLUMNS,
  onConflict: `ON CONFLICT (session_id) DO UPDATE SET ${[
    // version keeps its stored value; it is assigned only to carry the guard.
    unlessForeign(SESSION_FOREIGN, 'version', 'sessions.version'),
    'started = min(sessions.started, excluded.started)',
    // Multi-argument max() is NULL when any argument is NULL; coalesce falls back to the non-null side.
    'ended = coalesce(max(sessions.ended, excluded.ended), sessions.ended, excluded.ended)',
    ...newestNonNull('sessions', SESSION_NEWER, [
      'boot_ms',
      'engine_ok',
      'engine_exit_code',
      'engine_stderr_tail',
      'low_memory_trims',
      'battery_opt_ignored',
      'fg_service_ok',
      'a11y_on',
      'counters',
      'country',
    ]),
    'received = max(sessions.received, excluded.received)',
  ].join(', ')}`,
};

/** Event columns in storage order. */
export const EVENT_COLUMNS = columnsOf<EventRow>()([
  'session_id',
  'seq',
  'install_id',
  'device_id',
  'name',
  'props',
  'ts_client',
  'ts',
  'received',
]);

// `ON CONFLICT (pk) DO NOTHING` rather than `INSERT OR IGNORE`: same result for
// a replayed key, but a NOT NULL violation (an op bug) still fails loudly
// instead of silently dropping the row.

/** events: insert-or-ignore on (session_id, seq). */
export const EVENTS: TableSpec<EventRow> = {
  table: 'events',
  columns: EVENT_COLUMNS,
  onConflict: 'ON CONFLICT (session_id, seq) DO NOTHING',
};

/** Error columns in storage order. */
export const ERROR_COLUMNS = columnsOf<ErrorRow>()([
  'error_id',
  'error_key',
  'kind',
  'session_id',
  'seq',
  'install_id',
  'device_id',
  'version',
  'class_name',
  'message',
  'frames',
  'ts_client',
  'ts',
  'received',
]);

/** errors: insert-or-ignore on error_id. */
export const ERRORS: TableSpec<ErrorRow> = {
  table: 'errors',
  columns: ERROR_COLUMNS,
  onConflict: 'ON CONFLICT (error_id) DO NOTHING',
};

/** reports: insert-or-ignore on report_id. */
export const REPORTS: TableSpec<ReportRow> = {
  table: 'reports',
  columns: columnsOf<ReportRow>()([
    'report_id',
    'install_id',
    'device_id',
    'session_id',
    'version',
    'channel',
    'note',
    'events',
    'log_tail',
    'device',
    'received',
  ]),
  onConflict: 'ON CONFLICT (report_id) DO NOTHING',
};

/** github_assets_daily: upsert on (day, tag, asset); the latest count replaces the stored one. */
export const GITHUB_ASSETS_DAILY: TableSpec<GithubAssetDailyRow> = {
  table: 'github_assets_daily',
  columns: columnsOf<GithubAssetDailyRow>()(['day', 'tag', 'asset', 'download_count']),
  onConflict: 'ON CONFLICT (day, tag, asset) DO UPDATE SET download_count = excluded.download_count',
};

const REPO_COLUMNS = columnsOf<GithubRepoDailyRow>()([
  'day',
  'stars',
  'forks',
  'watchers',
  'views',
  'view_uniques',
  'clones',
  'clone_uniques',
  'referrers',
]);

/** github_repo_daily: upsert on day; every counter is replaced by the latest run. */
export const GITHUB_REPO_DAILY: TableSpec<GithubRepoDailyRow> = {
  table: 'github_repo_daily',
  columns: REPO_COLUMNS,
  onConflict: `ON CONFLICT (day) DO UPDATE SET ${REPO_COLUMNS.filter((c) => c !== 'day')
    .map((c) => `${c} = excluded.${c}`)
    .join(', ')}`,
};

/**
 * site_daily: upsert on (day, kind, key, country); count adds the incoming
 * count (each point writes count 1, so a point is +1). Why not a plain
 * `count = count + 1`: adding excluded.count keeps the spec a true merge of
 * two rows, so the same statement stays right for any count it is given.
 */
export const SITE_DAILY: TableSpec<SiteDailyRow> = {
  table: 'site_daily',
  columns: columnsOf<SiteDailyRow>()(['day', 'kind', 'key', 'country', 'count']),
  onConflict: 'ON CONFLICT (day, kind, key, country) DO UPDATE SET count = site_daily.count + excluded.count',
};

/** share_links: insert-or-ignore on code, so the first device to send a code keeps it. */
export const SHARE_LINKS: TableSpec<ShareLinkRow> = {
  table: 'share_links',
  columns: columnsOf<ShareLinkRow>()(['code', 'device_id', 'created']),
  onConflict: 'ON CONFLICT (code) DO NOTHING',
};

/** share_daily: upsert on (code, step, day); count adds the incoming count, as site_daily does. */
export const SHARE_DAILY: TableSpec<ShareDailyRow> = {
  table: 'share_daily',
  columns: columnsOf<ShareDailyRow>()(['code', 'step', 'day', 'count']),
  onConflict: 'ON CONFLICT (code, step, day) DO UPDATE SET count = share_daily.count + excluded.count',
};

/**
 * share_installs columns. Its insert is not a plain spec insert: it also
 * skips a link the same device owns (stores/sql/share.ts, shareInstallInsert).
 */
export const SHARE_INSTALL_COLUMNS = columnsOf<ShareInstallRow>()(['device_id', 'code', 'ts', 'day']);

/** Read/delete shape of a table the retention cron drains. */
export interface RetentionSpec {
  table: string;
  columns: readonly string[];
  /** Primary-key columns, in key order. */
  key: readonly string[];
  /** Oldest-first scan; the PK tie-break is free because WITHOUT ROWID indexes carry the key. */
  orderBy: string;
}

/** events and errors, the two tables listExpired/deleteRows serve. */
export const RETENTION_SPECS: Readonly<Record<'events' | 'errors', RetentionSpec>> = {
  events: { table: 'events', columns: EVENT_COLUMNS, key: ['session_id', 'seq'], orderBy: 'received, session_id, seq' },
  errors: { table: 'errors', columns: ERROR_COLUMNS, key: ['error_id'], orderBy: 'received, error_id' },
};
