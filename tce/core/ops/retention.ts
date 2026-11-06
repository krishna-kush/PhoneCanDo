// Cron retention, every 15 minutes. Each run, in this order:
//   1. reports past RETENTION_DAYS.reports are deleted. First, so a run killed
//      by the CPU limit later on never skips report retention.
//   2. events, then errors, past RETENTION_DAYS: the oldest
//      RETENTION_RUN.rowsPerRun expired rows of the table are listed and
//      deleted (a free Workers invocation gets ~10 ms CPU, so each run is
//      bounded; the rest waits for the next run).
// There is no cold storage: expired rows are gone. Why delete rather than
// keep: they would otherwise pile up until the database is full for good (the
// free D1 plan stops at 500 MB). A backup is planned for when the database
// nears its limit (tce/docs/planning/todo.md).
// A step that fails keeps its rows (the next run retries) and never stops the
// steps after it; the summary carries a count and a status per step.
//
// Switched OFF for now (config.retentionEnabled, Cloudflare var
// RETENTION_ENABLED): we keep all data until the backup exists. The
// code stays tested. The published docs still promise RETENTION_DAYS, so
// scripts/check-limits.mjs warns before the oldest kept row reaches that age.

import type { CronOp, OpCtx } from '../op.ts';
import { ok, type TceResult } from '../result.ts';
import { RETENTION_DAYS, RETENTION_RUN } from '../schema/limits.ts';
import type { ArchivableTable } from '../schema/rows.ts';
import { DAY_MS } from '../time.ts';

/** Row tables the cron expires after reports, in run order. */
export const RETENTION_TABLES: readonly ArchivableTable[] = ['events', 'errors'];

/** What one step did: rows deleted, and 'deleted' | 'none' | 'list_failed:<code>' | 'delete_failed:<code>'. */
interface RetentionOutcome {
  status: string;
  count: number;
}

/** Earliest `received` a row of `kind` may have at `now` and still be kept. */
export function retentionCutoff(kind: keyof typeof RETENTION_DAYS, now: number): number {
  return now - RETENTION_DAYS[kind] * DAY_MS;
}

/** Delete reports received before their cutoff. */
async function expireReports(ctx: OpCtx, now: number): Promise<RetentionOutcome> {
  const deleted = await ctx.store.deleteExpiredReports(retentionCutoff('reports', now));
  if (!deleted.ok) {
    ctx.log.warn('retention: expired reports not deleted', { code: deleted.error.code, message: deleted.error.message });
    return { status: `delete_failed:${deleted.error.code}`, count: 0 };
  }
  return { status: deleted.value > 0 ? 'deleted' : 'none', count: deleted.value };
}

/** Delete up to RETENTION_RUN.rowsPerRun of the oldest expired rows of `table`. */
async function expireTable(ctx: OpCtx, table: ArchivableTable, now: number): Promise<RetentionOutcome> {
  const listed = await ctx.store.listExpired(table, retentionCutoff(table, now), RETENTION_RUN.rowsPerRun);
  if (!listed.ok) {
    ctx.log.warn('retention: listing expired rows failed', { table, code: listed.error.code, message: listed.error.message });
    return { status: `list_failed:${listed.error.code}`, count: 0 };
  }
  if (listed.value.length === 0) return { status: 'none', count: 0 };
  const deleted = await ctx.store.deleteRows(table, listed.value);
  if (!deleted.ok) {
    ctx.log.warn('retention: expired rows not deleted', { table, code: deleted.error.code, message: deleted.error.message });
    return { status: `delete_failed:${deleted.error.code}`, count: 0 };
  }
  return { status: 'deleted', count: deleted.value };
}

/** Cron retention, every 15 minutes. */
export const retentionOp: CronOp = {
  kind: 'cron',
  name: 'retention',
  // Why every 15 minutes: the per-run cap keeps each run inside the CPU
  // budget; 96 runs a day still delete up to 24k rows per table, more than a
  // normal day inserts, so the database does not grow behind the cron. (Same
  // expression as the cron it replaced, so the deployed triggers stay valid.)
  schedule: '*/15 * * * *',

  async run(ctx: OpCtx): Promise<TceResult<Record<string, number | string>>> {
    const now = ctx.clock.now();
    const summary: Record<string, number | string> = {};
    const record = (name: string, out: RetentionOutcome): void => {
      summary[name] = out.count;
      summary[`${name}Status`] = out.status;
    };
    if (!ctx.config.retentionEnabled) {
      // Nothing is listed or deleted, so a disabled run costs no D1 reads or writes.
      const off: RetentionOutcome = { status: 'disabled', count: 0 };
      record('reports', off);
      for (const table of RETENTION_TABLES) record(table, off);
      return ok(summary);
    }
    record('reports', await expireReports(ctx, now));
    for (const table of RETENTION_TABLES) record(table, await expireTable(ctx, table, now));
    return ok(summary);
  },
};
