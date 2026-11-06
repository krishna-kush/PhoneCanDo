-- tce schema v1.2, additive only.
--   site_daily: permanent daily rollup of site page views and download clicks.
--   Analytics Engine keeps the detailed points only three months; this keeps
--   the totals forever (one row per day, kind, key and country; key = path for
--   'view', channel for 'download'; country '' when unknown). One row write per
--   counted hit (the primary key is the table, no extra index).

CREATE TABLE site_daily (
  day     TEXT    NOT NULL,
  kind    TEXT    NOT NULL,
  key     TEXT    NOT NULL,
  country TEXT    NOT NULL,
  count   INTEGER NOT NULL,
  PRIMARY KEY (day, kind, key, country)
) WITHOUT ROWID;
