-- node:sqlite-only tables: where this store keeps the analytics points that
-- Cloudflare sends to Analytics Engine (datasets `phonecando_pageviews` and
-- `phonecando_downloads`). Same fields as PagePoint / DownloadPoint in
-- core/schema/rows.ts, plus the server time `ts` (epoch ms). No identity.
-- Never edit a shipped migration; add 0002_*.sql here.

CREATE TABLE points_pageviews (
  ts       INTEGER NOT NULL,
  path     TEXT    NOT NULL,
  ref_host TEXT,
  country  TEXT,
  ua_class TEXT    NOT NULL
);
CREATE INDEX points_pageviews_ts ON points_pageviews (ts);

CREATE TABLE points_downloads (
  ts            INTEGER NOT NULL,
  channel       TEXT    NOT NULL,
  version       TEXT    NOT NULL,
  country       TEXT,
  android_major INTEGER,
  ref_host      TEXT,
  ua_class      TEXT    NOT NULL
);
CREATE INDEX points_downloads_ts ON points_downloads (ts);
