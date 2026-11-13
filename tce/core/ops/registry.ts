// The single list of operations. Hosts iterate these arrays to build routes
// and cron handlers; adding an op is one file in this folder and one line here.

import type { AnyHttpOp, CronOp, Op } from '../op.ts';
import { batchOp } from './batch.ts';
import { downloadOp } from './download.ts';
import { forgetOp } from './forget.ts';
import { githubDailyOp } from './github-daily.ts';
import { healthOp } from './health.ts';
import { hitOp } from './hit.ts';
import { reportOp } from './report.ts';
import { shareOpenOp } from './share-open.ts';
import { shareStatsOp } from './share-stats.ts';

/** HTTP operations, matched by method and path. */
export const httpOps: readonly AnyHttpOp[] = [
  batchOp,
  hitOp,
  downloadOp,
  reportOp,
  forgetOp,
  healthOp,
  shareOpenOp,
  shareStatsOp,
];

/**
 * Cron operations, matched by schedule. The retention op (./retention.ts) is
 * written and tested but not scheduled while we keep all data: to turn
 * deletion on, add `retentionOp` here, add its schedule ('*\/15 * * * *') to
 * triggers.crons in hosts/cloudflare/wrangler.jsonc, and set RETENTION_ENABLED
 * to "true" there.
 */
export const cronOps: readonly CronOp[] = [githubDailyOp];

/** Every operation. */
export const ops: readonly Op[] = [...httpOps, ...cronOps];
