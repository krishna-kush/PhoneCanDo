// Storage shapes, one interface per table in stores/sql/migrations. snake_case
// so SQL stores bind them directly. Booleans are 0/1, JSON columns are strings,
// times are epoch ms (UTC). `received` is server time; `ts` is the client time
// corrected by the batch's clock skew; `ts_client` is the raw client time.

export type TableName =
  | 'devices'
  | 'installs'
  | 'sessions'
  | 'events'
  | 'errors'
  | 'reports'
  | 'github_assets_daily'
  | 'github_repo_daily'
  | 'site_daily';

/** Tables `forget` clears for a device. */
export type ForgettableTable = 'devices' | 'installs' | 'sessions' | 'events' | 'errors' | 'reports';

/** Tables the retention cron deletes expired rows from (there is no cold storage yet). */
export type ArchivableTable = 'events' | 'errors';

export type Bit = 0 | 1;

/**
 * Merge on device_id: first_seen = min, last_seen = max, other fields from the
 * newer row; drm_id keeps the last non-null; verifier is first-write-wins and
 * never overwritten (a write carrying a different verifier is refused before
 * the merge, see Store.applyBatch).
 */
export interface DeviceRow {
  device_id: string;
  /** SHA-256 hex of the device's forget proof; null only for rows written before migration 0002. */
  verifier: string | null;
  hw_hash: string;
  drm_id: string | null;
  manufacturer: string;
  model: string;
  sdk_int: number;
  abi: string;
  ram_gb: number;
  locale: string;
  country: string | null;
  asn: number | null;
  tester: Bit;
  first_seen: number;
  last_seen: number;
}

/** Merge on (install_id, device_id): first_* from the older row, last_* and the rest from the newer. */
export interface InstallRow {
  install_id: string;
  device_id: string;
  channel: string;
  install_source: string | null;
  first_version: string;
  last_version: string;
  last_version_code: number;
  first_seen: number;
  last_seen: number;
}

/**
 * Merge on session_id: started = min, ended = max non-null, every nullable
 * field keeps the newest non-null value (newest by `received`), received = max.
 * Never rewritten: install_id, device_id, and the build a session ran
 * (version, version_code, channel) — first write wins, so a later batch from
 * an updated app cannot re-attribute an old session.
 */
export interface SessionRow {
  session_id: string;
  install_id: string;
  device_id: string;
  version: string;
  version_code: number;
  channel: string;
  started: number;
  ended: number | null;
  boot_ms: number | null;
  engine_ok: Bit | null;
  engine_exit_code: number | null;
  engine_stderr_tail: string | null;
  low_memory_trims: number | null;
  battery_opt_ignored: Bit | null;
  fg_service_ok: Bit | null;
  a11y_on: Bit | null;
  /** JSON object of counters; newer replaces older. */
  counters: string | null;
  country: string | null;
  received: number;
}

/** Insert-or-ignore on (session_id, seq). */
export interface EventRow {
  session_id: string;
  seq: number;
  install_id: string;
  device_id: string;
  name: string;
  /** JSON object or null. */
  props: string | null;
  ts_client: number;
  ts: number;
  received: number;
}

/** Insert-or-ignore on error_id. */
export interface ErrorRow {
  error_id: string;
  /** SHA-256 hex of kind + class + top frame + version, computed by the server. */
  error_key: string;
  kind: string;
  session_id: string | null;
  seq: number | null;
  install_id: string;
  device_id: string;
  version: string;
  class_name: string;
  message: string;
  /** JSON array of strings. */
  frames: string;
  ts_client: number;
  ts: number;
  received: number;
}

/** Insert-or-ignore on report_id. */
export interface ReportRow {
  report_id: string;
  install_id: string;
  device_id: string;
  session_id: string | null;
  version: string;
  channel: string;
  note: string | null;
  /** JSON array of EventWire. */
  events: string;
  log_tail: string | null;
  /** JSON of DeviceWire. */
  device: string;
  received: number;
}

/** Upsert on (day, tag, asset). day = YYYY-MM-DD (UTC). */
export interface GithubAssetDailyRow {
  day: string;
  tag: string;
  asset: string;
  download_count: number;
}

/** Upsert on day. Traffic fields are null without a token. */
export interface GithubRepoDailyRow {
  day: string;
  stars: number;
  forks: number;
  watchers: number;
  views: number | null;
  view_uniques: number | null;
  clones: number | null;
  clone_uniques: number | null;
  /** JSON array of { referrer, count, uniques }. */
  referrers: string | null;
}

export type UaClass = 'bot' | 'android' | 'ios' | 'desktop' | 'other';

/**
 * Analytics point, no identity. Cloudflare: AE dataset `pageviews` (detail, 3
 * months) AND +1 on site_daily (day, 'view', path, country) kept forever.
 */
export interface PagePoint {
  /** UTC day of the hit, YYYY-MM-DD (the op derives it from ctx.clock). */
  day: string;
  path: string;
  refHost: string | null;
  country: string | null;
  uaClass: UaClass;
}

/**
 * Analytics point, no identity. Cloudflare: AE dataset `downloads` (detail, 3
 * months) AND +1 on site_daily (day, 'download', channel, country) kept forever.
 */
export interface DownloadPoint {
  /** UTC day of the download, YYYY-MM-DD. */
  day: string;
  channel: 'lite' | 'full';
  version: string;
  country: string | null;
  androidMajor: number | null;
  refHost: string | null;
  uaClass: UaClass;
}

/**
 * Permanent daily rollup of site traffic (Analytics Engine keeps detail only
 * 3 months). Upsert on (day, kind, key, country): count += 1 per point.
 * key = path for 'view', channel for 'download'; country '' when unknown.
 */
export interface SiteDailyRow {
  day: string;
  kind: 'view' | 'download';
  key: string;
  country: string;
  count: number;
}

export interface ArchiveRowMap {
  events: EventRow;
  errors: ErrorRow;
}
