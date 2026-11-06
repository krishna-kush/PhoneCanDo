// The points sink of the node:sqlite store.
//
// Points go to two local tables in the same database (migrations/0001_points.sql)
// rather than memory. Why: the node host is the own-server option, and the
// detailed page and download points must survive a restart there just as
// Analytics Engine keeps them on Cloudflare. They are plain appends, so they
// cost one row write each; the shared store adds the site_daily rollup itself.

import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '../../core/clock.ts';
import type { DownloadPoint, PagePoint } from '../../core/schema/rows.ts';
import type { PointsSink } from '../sql/store.ts';

/** PointsSink appending to points_pageviews / points_downloads, stamped with `clock`. */
export function createTablePointsSink(db: DatabaseSync, clock: Clock): PointsSink {
  const page = db.prepare('INSERT INTO points_pageviews (ts, path, ref_host, country, ua_class) VALUES (?, ?, ?, ?, ?)');
  const download = db.prepare(
    'INSERT INTO points_downloads (ts, channel, version, country, android_major, ref_host, ua_class) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  return {
    page(p: PagePoint): void {
      page.run(clock.now(), p.path, p.refHost, p.country, p.uaClass);
    },
    download(p: DownloadPoint): void {
      download.run(clock.now(), p.channel, p.version, p.country, p.androidMajor, p.refHost, p.uaClass);
    },
  };
}
