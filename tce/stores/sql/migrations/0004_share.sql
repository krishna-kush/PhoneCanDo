-- tce schema v1.3, additive only.
--   share_links: the share links a phone sent (event share.sent), owned by
--   the first device that sent the code; kept until that device's Delete my
--   data.
--   share_daily: opens and downloads per link and UTC day, no identity. The
--   key leads with the code because every read is by code (the app's Tell a
--   friend page) and forget deletes by code; no extra index.
--   share_installs: the link a phone's install came through (event
--   share.install), one per phone, first link wins. Indexed by code for the
--   page's counts and for forget.

CREATE TABLE share_links (
  code      TEXT    NOT NULL PRIMARY KEY,
  device_id TEXT    NOT NULL,
  created   INTEGER NOT NULL
) WITHOUT ROWID;

CREATE INDEX share_links_device ON share_links (device_id);

CREATE TABLE share_daily (
  code  TEXT    NOT NULL,
  step  TEXT    NOT NULL CHECK (step IN ('open', 'download')),
  day   TEXT    NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (code, step, day)
) WITHOUT ROWID;

CREATE TABLE share_installs (
  device_id TEXT    NOT NULL PRIMARY KEY,
  code      TEXT    NOT NULL,
  ts        INTEGER NOT NULL,
  day       TEXT    NOT NULL
) WITHOUT ROWID;

CREATE INDEX share_installs_code ON share_installs (code);
