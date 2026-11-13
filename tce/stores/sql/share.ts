// Share links (migration 0004): the rows a batch's share events add, the +1
// of an open or a download, forget's deletes and the stats read. Pure: no
// driver calls here; createSqlStore runs what this builds.

import { err, ok } from '../../core/result.ts';
import type { TceResult } from '../../core/result.ts';
import type { ShareDailyRow, ShareInstallRow, ShareLinkRow } from '../../core/schema/rows.ts';
import type { ShareLinkStats } from '../../core/schema/wire.ts';
import { STATEMENT_LIMITS, buildInserts, placeholders, toSqlValue } from './chunk.ts';
import type { SqlStatement, SqlValue } from './driver.ts';
import { dayBound } from './site.ts';
import { SHARE_DAILY, SHARE_INSTALL_COLUMNS, SHARE_LINKS } from './tables.ts';

/**
 * applyBatch's share statements, links first so an install in the same batch
 * already sees its own device's link. An install row is inserted only when
 * the device has none yet (first link wins) and the code is not its own.
 */
export function shareBatchStatements(links: readonly ShareLinkRow[], installs: readonly ShareInstallRow[]): SqlStatement[] {
  return [...buildInserts(SHARE_LINKS, links), ...installs.map(shareInstallInsert)];
}

/** One share_installs insert-or-ignore that skips a link the same device owns. */
function shareInstallInsert(row: ShareInstallRow): SqlStatement {
  const cols = SHARE_INSTALL_COLUMNS;
  return {
    sql:
      `INSERT INTO share_installs (${cols.join(', ')}) SELECT ${cols.map(() => '?').join(', ')} ` +
      // The WHERE also settles SQLite's INSERT ... SELECT ... ON CONFLICT parsing ambiguity.
      'WHERE NOT EXISTS (SELECT 1 FROM share_links WHERE code = ? AND device_id = ?) ON CONFLICT (device_id) DO NOTHING',
    params: [...cols.map((c) => toSqlValue(row[c], c)), row.code, row.device_id],
  };
}

/** The upsert for one share_daily row, or bad_request for a malformed day or an unknown step. */
export function shareStepStatement(row: ShareDailyRow): TceResult<SqlStatement> {
  const day = dayBound(row.day, 'day');
  if (!day.ok) return day;
  if (row.step !== 'open' && row.step !== 'download') return err('bad_request', "step must be 'open' or 'download'", 'step');
  const [stmt] = buildInserts(SHARE_DAILY, [row]);
  return stmt ? ok(stmt) : err('internal', 'no statement built for a share_daily row');
}

/**
 * forget()'s share deletes, keyed like FORGET_STATEMENTS; each binds the
 * device_id once (`?1` where it is used twice). The device's links' counts
 * and the installs that came through them go before the links themselves,
 * which they are found through; then the device's own install through
 * someone else's link. All index lookups: share_links_device,
 * share_installs_code and the primary keys.
 */
export const SHARE_FORGET_STATEMENTS = {
  share_daily: 'DELETE FROM share_daily WHERE code IN (SELECT code FROM share_links WHERE device_id = ?)',
  share_installs:
    'DELETE FROM share_installs WHERE device_id = ?1 OR code IN (SELECT code FROM share_links WHERE device_id = ?1)',
  share_links: 'DELETE FROM share_links WHERE device_id = ?',
} as const;

/** One stats read: opens and downloads per code and step, from share_daily. */
function dailyStats(codes: readonly string[]): SqlStatement {
  return {
    sql:
      'SELECT code, step, sum(count) AS n, max(day) AS last_day FROM share_daily ' +
      `WHERE code IN ${placeholders(codes.length)} GROUP BY code, step`,
    params: [...codes],
  };
}

/**
 * One stats read: installs per code, the ones whose device has a session
 * that started on a UTC day after the install's day (`active`), and the last
 * install day. Sessions are found by device (sessions_device).
 */
function installStats(codes: readonly string[]): SqlStatement {
  return {
    sql:
      'SELECT code, count(*) AS installed, ' +
      'sum(EXISTS (SELECT 1 FROM sessions s WHERE s.device_id = i.device_id ' +
      "AND s.started >= (strftime('%s', i.day) + 86400) * 1000)) AS active, max(day) AS last_day " +
      `FROM share_installs i WHERE code IN ${placeholders(codes.length)} GROUP BY code`,
    params: [...codes],
  };
}

/** The stats reads for `codes`, two per slice of at most STATEMENT_LIMITS.maxParams codes. */
export function shareStatsStatements(codes: readonly string[]): { daily: SqlStatement[]; installs: SqlStatement[] } {
  const daily: SqlStatement[] = [];
  const installs: SqlStatement[] = [];
  for (let i = 0; i < codes.length; i += STATEMENT_LIMITS.maxParams) {
    const slice = codes.slice(i, i + STATEMENT_LIMITS.maxParams);
    daily.push(dailyStats(slice));
    installs.push(installStats(slice));
  }
  return { daily, installs };
}

/** A daily stats row read back. */
export interface DailyStatsRow {
  code: SqlValue;
  step: SqlValue;
  n: SqlValue;
  last_day: SqlValue;
}

/** An install stats row read back. */
export interface InstallStatsRow {
  code: SqlValue;
  installed: SqlValue;
  active: SqlValue;
  last_day: SqlValue;
}

/** The later of two YYYY-MM-DD days (null counts as none). */
function laterDay(a: string | null, b: SqlValue): string | null {
  const day = typeof b === 'string' ? b : null;
  if (a === null) return day;
  return day !== null && day > a ? day : a;
}

/** One ShareLinkStats per code, in `codes` order, from the rows the reads returned. */
export function shareStatsFrom(
  codes: readonly string[],
  daily: readonly DailyStatsRow[],
  installs: readonly InstallStatsRow[],
): ShareLinkStats[] {
  const byCode = new Map<string, ShareLinkStats>();
  for (const code of codes) byCode.set(code, { code, opened: 0, downloaded: 0, installed: 0, using: 0, lastDay: null });
  for (const r of daily) {
    const s = byCode.get(String(r.code));
    if (!s) continue;
    const n = Number(r.n) || 0;
    if (r.step === 'open') s.opened += n;
    else if (r.step === 'download') s.downloaded += n;
    s.lastDay = laterDay(s.lastDay, r.last_day);
  }
  for (const r of installs) {
    const s = byCode.get(String(r.code));
    if (!s) continue;
    s.installed += Number(r.installed) || 0;
    s.using += Number(r.active) || 0;
    s.lastDay = laterDay(s.lastDay, r.last_day);
  }
  return [...byCode.values()];
}
