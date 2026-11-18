-- tce schema v1.4, additive only.
--   campaign_daily: opens and downloads per campaign tag (`?c=<tag>` on the
--   site) and UTC day, no identity and no owner, so forget never touches
--   it. Counted only for a tag in campaigns.
--   campaigns: the campaign tags we made (`./manage campaign add <tag>
--   "<note>"`, which talks to D1 with the cf CLI), with where the link was
--   posted (note) and the UTC day it was added (YYYY-MM-DD). campaign_daily
--   counts a `?c=<tag>` only when its tag is here, checked in the counting
--   statement itself, so a new campaign counts at once with no push, and a
--   made-up tag never fills the table. The site never sees the list: its
--   page sends any well-formed tag. No identity and no owner, so forget
--   never touches it.

CREATE TABLE campaign_daily (
  tag   TEXT    NOT NULL,
  step  TEXT    NOT NULL CHECK (step IN ('open', 'download')),
  day   TEXT    NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (tag, step, day)
) WITHOUT ROWID;

CREATE TABLE campaigns (
  tag   TEXT NOT NULL PRIMARY KEY,
  note  TEXT NOT NULL,
  added TEXT NOT NULL
) WITHOUT ROWID;
