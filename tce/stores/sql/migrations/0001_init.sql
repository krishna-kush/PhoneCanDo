-- tce schema v1: one table per interface in core/schema/rows.ts.
-- Shared by every SQL store (Cloudflare D1 via `wrangler d1 migrations apply`,
-- node:sqlite via stores/sqlite). Never edit a shipped migration; add 0002_*.sql.
-- Indexes are deliberate: each one costs a D1 row write per insert.

CREATE TABLE devices (
  device_id    TEXT    PRIMARY KEY,
  hw_hash      TEXT    NOT NULL,
  drm_id       TEXT,
  manufacturer TEXT    NOT NULL,
  model        TEXT    NOT NULL,
  sdk_int      INTEGER NOT NULL,
  abi          TEXT    NOT NULL,
  ram_gb       INTEGER NOT NULL,
  locale       TEXT    NOT NULL,
  country      TEXT,
  asn          INTEGER,
  tester       INTEGER NOT NULL DEFAULT 0,
  first_seen   INTEGER NOT NULL,
  last_seen    INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE installs (
  install_id        TEXT    NOT NULL,
  device_id         TEXT    NOT NULL,
  channel           TEXT    NOT NULL,
  install_source    TEXT,
  first_version     TEXT    NOT NULL,
  last_version      TEXT    NOT NULL,
  last_version_code INTEGER NOT NULL,
  first_seen        INTEGER NOT NULL,
  last_seen         INTEGER NOT NULL,
  PRIMARY KEY (install_id, device_id)
) WITHOUT ROWID;
-- forget() deletes by device_id.
CREATE INDEX installs_device ON installs (device_id);

CREATE TABLE sessions (
  session_id          TEXT    PRIMARY KEY,
  install_id          TEXT    NOT NULL,
  device_id           TEXT    NOT NULL,
  version             TEXT    NOT NULL,
  version_code        INTEGER NOT NULL,
  channel             TEXT    NOT NULL,
  started             INTEGER NOT NULL,
  ended               INTEGER,
  boot_ms             INTEGER,
  engine_ok           INTEGER,
  engine_exit_code    INTEGER,
  engine_stderr_tail  TEXT,
  low_memory_trims    INTEGER,
  battery_opt_ignored INTEGER,
  fg_service_ok       INTEGER,
  a11y_on             INTEGER,
  counters            TEXT,
  country             TEXT,
  received            INTEGER NOT NULL
) WITHOUT ROWID;
-- forget() and per-device queries.
CREATE INDEX sessions_device ON sessions (device_id);

-- forget() reaches events through sessions(device_id); no device index here.
CREATE TABLE events (
  session_id TEXT    NOT NULL,
  seq        INTEGER NOT NULL,
  install_id TEXT    NOT NULL,
  device_id  TEXT    NOT NULL,
  name       TEXT    NOT NULL,
  props      TEXT,
  ts_client  INTEGER NOT NULL,
  ts         INTEGER NOT NULL,
  received   INTEGER NOT NULL,
  PRIMARY KEY (session_id, seq)
) WITHOUT ROWID;
-- archive cron scans by received.
CREATE INDEX events_received ON events (received);

CREATE TABLE errors (
  error_id   TEXT    PRIMARY KEY,
  error_key  TEXT    NOT NULL,
  kind       TEXT    NOT NULL,
  session_id TEXT,
  seq        INTEGER,
  install_id TEXT    NOT NULL,
  device_id  TEXT    NOT NULL,
  version    TEXT    NOT NULL,
  class_name TEXT    NOT NULL,
  message    TEXT    NOT NULL,
  frames     TEXT    NOT NULL,
  ts_client  INTEGER NOT NULL,
  ts         INTEGER NOT NULL,
  received   INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX errors_received ON errors (received);
CREATE INDEX errors_key ON errors (error_key);

CREATE TABLE reports (
  report_id  TEXT    PRIMARY KEY,
  install_id TEXT    NOT NULL,
  device_id  TEXT    NOT NULL,
  session_id TEXT,
  version    TEXT    NOT NULL,
  channel    TEXT    NOT NULL,
  note       TEXT,
  events     TEXT    NOT NULL,
  log_tail   TEXT,
  device     TEXT    NOT NULL,
  received   INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE github_assets_daily (
  day            TEXT    NOT NULL,
  tag            TEXT    NOT NULL,
  asset          TEXT    NOT NULL,
  download_count INTEGER NOT NULL,
  PRIMARY KEY (day, tag, asset)
) WITHOUT ROWID;

CREATE TABLE github_repo_daily (
  day           TEXT    PRIMARY KEY,
  stars         INTEGER NOT NULL,
  forks         INTEGER NOT NULL,
  watchers      INTEGER NOT NULL,
  views         INTEGER,
  view_uniques  INTEGER,
  clones        INTEGER,
  clone_uniques INTEGER,
  referrers     TEXT
) WITHOUT ROWID;
