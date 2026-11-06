// Analytics Engine as the PointsSink. The blob and index order below IS the
// query schema: AE SQL addresses fields by position (blob1, blob2, ...), so
// never reorder, only append.
//
// Dataset `phonecando_pageviews` (binding PAGEVIEWS), one point per page view:
//   index1  country, 'XX' when unknown (AE samples per index value)
//   blob1   path
//   blob2   referrer host, '' when none
//   blob3   country, '' when unknown
//   blob4   UA class: bot | android | ios | desktop | other
//   double1 1 (count)
//
// Dataset `phonecando_downloads` (binding DOWNLOADS), one point per /dl hit:
//   index1  channel
//   blob1   channel: lite | full
//   blob2   version
//   blob3   country, '' when unknown
//   blob4   Android major version from the UA, '' when unknown
//   blob5   referrer host, '' when none
//   blob6   UA class
//   double1 1 (count)
//
// e.g. SELECT blob1 AS channel, SUM(_sample_interval * double1) AS downloads
//      FROM phonecando_downloads GROUP BY channel

import type { DownloadPoint, PagePoint } from '../../core/schema/rows.ts';
import type { PointsSink } from '../sql/store.ts';

/** The AE data point for a page view. */
export function pageviewDataPoint(p: PagePoint): AnalyticsEngineDataPoint {
  return {
    blobs: [p.path, p.refHost ?? '', p.country ?? '', p.uaClass],
    doubles: [1],
    indexes: [p.country ?? 'XX'],
  };
}

/** The AE data point for a download. */
export function downloadDataPoint(p: DownloadPoint): AnalyticsEngineDataPoint {
  return {
    blobs: [p.channel, p.version, p.country ?? '', p.androidMajor == null ? '' : String(p.androidMajor), p.refHost ?? '', p.uaClass],
    doubles: [1],
    indexes: [p.channel],
  };
}

/**
 * PointsSink writing to the two datasets. A missing binding drops its points
 * (a deployment without AE still serves); undefined when both are missing.
 */
export function createAnalyticsSink(
  pageviews: AnalyticsEngineDataset | undefined,
  downloads: AnalyticsEngineDataset | undefined,
): PointsSink | undefined {
  if (!pageviews && !downloads) return undefined;
  return {
    page(p: PagePoint): void {
      pageviews?.writeDataPoint(pageviewDataPoint(p));
    },
    download(p: DownloadPoint): void {
      downloads?.writeDataPoint(downloadDataPoint(p));
    },
  };
}
