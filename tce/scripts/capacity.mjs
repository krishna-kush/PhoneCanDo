// Free-plan capacity for scripts/check-limits.mjs: thresholds, messages and
// output. Pure (no I/O, no clock). The limits are CAPACITY in
// core/schema/limits.ts, read as text because scripts may not import core
// (scripts/check-deps.mjs); GET /api/health reports the same ratios live.
import { formatTable } from './text-table.mjs';

/** CAPACITY fields the check needs. */
export const CAPACITY_KEYS = ['dbLimitBytes', 'd1RowsWrittenPerDay', 'd1RowsReadPerDay', 'workerRequestsPerDay', 'warnRatio', 'guardRatio'];

/** Where the storage warnings point the reader. */
export const BACKUP_PLAN = 'tce/docs/planning/todo.md, Backup section';

/** Reads the number literals of `export const CAPACITY = { ... } as const` from limits.ts source. Throws when a needed one is missing. */
export function parseCapacity(source) {
  const block = /export\s+const\s+CAPACITY\s*=\s*\{([\s\S]*?)\}\s*as\s+const/.exec(source);
  if (!block) throw new Error('no `export const CAPACITY = { ... } as const` block');
  const body = block[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const out = {};
  for (const m of body.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*([0-9][0-9_]*(?:\.[0-9]+)?)\s*(?=,|\s*$)/gm)) {
    out[m[1]] = Number(m[2].replaceAll('_', ''));
  }
  for (const k of CAPACITY_KEYS) {
    if (!Number.isFinite(out[k])) throw new Error(`CAPACITY.${k} is missing or not a number literal`);
  }
  if (!(out.warnRatio > 0 && out.warnRatio < out.guardRatio && out.guardRatio <= 1)) {
    throw new Error(`CAPACITY ratios must satisfy 0 < warnRatio < guardRatio <= 1 (got ${out.warnRatio}, ${out.guardRatio})`);
  }
  return out;
}

/** 'ok' below warnRatio, 'warn' from it, 'critical' from guardRatio; 'unknown' without a usable ratio. */
export function levelOf(ratio, { warnRatio, guardRatio }) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return 'unknown';
  if (ratio >= guardRatio) return 'critical';
  if (ratio >= warnRatio) return 'warn';
  return 'ok';
}

/**
 * Thresholds and metric rows from what was measured. `capacity` is the parsed
 * CAPACITY (or null), `health` a HealthResponse (or null), `cf` the Cloudflare
 * figures (or null): { rowsRead, rowsWritten, requests, sizeBytes }, each a
 * number or null. Only known values become rows. Storage takes the larger of
 * the Worker's and the REST API's figure; the live ratios win over the file's.
 */
export function buildMetrics({ capacity, health, cf }) {
  const thresholds = health
    ? { warnRatio: health.db.warnRatio, guardRatio: health.db.guardRatio }
    : capacity
      ? { warnRatio: capacity.warnRatio, guardRatio: capacity.guardRatio }
      : null;
  const metrics = [];
  const sizes = [health?.db.bytes, cf?.sizeBytes].filter((v) => typeof v === 'number');
  const dbLimit = health?.db.limitBytes ?? capacity?.dbLimitBytes;
  if (sizes.length && dbLimit) metrics.push({ id: 'storage', label: 'D1 storage', unit: 'bytes', used: Math.max(...sizes), limit: dbLimit });
  if (capacity && cf) {
    const daily = [
      ['rowsWritten', 'D1 rows written today (UTC)', cf.rowsWritten, capacity.d1RowsWrittenPerDay],
      ['rowsRead', 'D1 rows read today (UTC)', cf.rowsRead, capacity.d1RowsReadPerDay],
      ['requests', 'Worker requests today (UTC)', cf.requests, capacity.workerRequestsPerDay],
    ];
    for (const [id, label, used, limit] of daily) {
      if (typeof used === 'number') metrics.push({ id, label, unit: 'count', used, limit });
    }
  }
  return { thresholds, metrics };
}

/** Adds `ratio` (used / limit, null when unknown) and `level` to each metric. */
export function evaluate(metrics, thresholds) {
  return metrics.map((m) => {
    const ratio = typeof m.used === 'number' && m.limit > 0 ? m.used / m.limit : null;
    return { ...m, ratio, level: levelOf(ratio, thresholds) };
  });
}

/** 1234567 -> "1,234,567" (locale-independent). */
export function formatCount(n) {
  return typeof n === 'number' ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '?';
}

/** Decimal units, like the plan's "500 MB": 360123456 -> "360.1 MB". */
export function formatBytes(n) {
  if (typeof n !== 'number') return '?';
  for (const [unit, size] of [['GB', 1e9], ['MB', 1e6], ['kB', 1e3]]) {
    if (n >= size) {
      const v = n / size;
      return `${Number.isInteger(v) ? v : v.toFixed(1)} ${unit}`;
    }
  }
  return `${n} B`;
}

/** 0.7234 -> "72.3%"; "?" when unknown. */
export function formatPercent(ratio) {
  return typeof ratio === 'number' && Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '?';
}

const formatValue = (m, v) => (m.unit === 'bytes' ? formatBytes(v) : formatCount(v));
const LEVEL_TEXT = { ok: 'ok', warn: 'WARN', critical: 'CRITICAL', unknown: '?' };

/** The metric table: metric, used, limit, %, state. */
export function renderTable(evaluated) {
  return formatTable(
    ['Metric', 'Used', 'Limit', '%', 'State'],
    evaluated.map((m) => [m.label, formatValue(m, m.used), formatValue(m, m.limit), formatPercent(m.ratio), LEVEL_TEXT[m.level]]),
    [1, 2, 3],
  );
}

/** What happens past each limit, for the warning text. */
const CONSEQUENCE = {
  storage: (t) => `the storage guard refuses new telemetry from ${formatPercent(t.guardRatio)}, and D1 refuses writes at 100%`,
  rowsWritten: () => 'past 100% D1 refuses writes until 00:00 UTC',
  rowsRead: () => 'past 100% D1 refuses queries until 00:00 UTC',
  requests: () => 'past 100% the Worker answers errors until 00:00 UTC',
};

/** One warning text per metric at warn or critical, plus the paused-ingest state. Each is { level, text }. */
export function findings(evaluated, { ingestPaused = false } = {}, thresholds) {
  const out = [];
  for (const m of evaluated) {
    if (m.level !== 'warn' && m.level !== 'critical') continue;
    const critical = m.level === 'critical';
    const limit = m.unit === 'bytes' ? formatBytes(m.limit) : `${formatCount(m.limit)}/day`;
    const head = `${critical ? 'CRITICAL: ' : ''}${m.label} at ${formatPercent(m.ratio)} of the free plan's ${limit} (${formatValue(m, m.used)})`;
    const why = CONSEQUENCE[m.id]?.(thresholds);
    const todo = m.id === 'storage' ? ` ${critical ? 'Build' : 'Plan'} the backup now: ${BACKUP_PLAN}.` : '';
    out.push({ level: m.level, text: `${head}${why ? `; ${why}` : ''}.${todo}` });
  }
  if (ingestPaused) {
    out.push({
      level: 'critical',
      text: `CRITICAL: the storage guard is refusing new telemetry right now (Delete my data still works). Build the backup: ${BACKUP_PLAN}.`,
    });
  }
  return out;
}

/** A GitHub Actions warning annotation (workflow-command escaping). */
export function annotation(text, title = 'tce capacity') {
  const data = (s) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const prop = (s) => data(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
  return `::warning title=${prop(title)}::${data(text)}`;
}

/** The job summary: the table as Markdown, then findings and notes. */
export function renderSummary(evaluated, warnings, notes) {
  const cell = (s) => String(s).replace(/\|/g, '\\|');
  const lines = ['### TCE capacity (free plan)', ''];
  if (evaluated.length) {
    lines.push('| Metric | Used | Limit | % | State |', '|---|---:|---:|---:|---|');
    for (const m of evaluated) {
      lines.push(`| ${cell(m.label)} | ${formatValue(m, m.used)} | ${formatValue(m, m.limit)} | ${formatPercent(m.ratio)} | ${LEVEL_TEXT[m.level]} |`);
    }
    lines.push('');
  }
  for (const w of warnings) lines.push(`- ${w.level === 'critical' ? '' : 'Warning: '}${cell(w.text)}`);
  for (const n of notes) lines.push(`- ${cell(n)}`);
  return `${lines.join('\n')}\n`;
}

/** 1 only under --strict with a metric at guardRatio or ingest paused; otherwise 0 (network trouble never fails). */
export function exitCode({ strict, evaluated, ingestPaused }) {
  if (!strict) return 0;
  return ingestPaused || evaluated.some((m) => m.level === 'critical') ? 1 : 0;
}
