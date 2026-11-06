// Unit tests for scripts/capacity.mjs (thresholds, metrics, messages, output).
//   node --test tce/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  BACKUP_PLAN,
  CAPACITY_KEYS,
  annotation,
  buildMetrics,
  evaluate,
  exitCode,
  findings,
  formatBytes,
  formatCount,
  formatPercent,
  levelOf,
  parseCapacity,
  renderSummary,
  renderTable,
} from './capacity.mjs';
import { TCE } from './wrangler-config.mjs';

const T = { warnRatio: 0.7, guardRatio: 0.9 };
const CAP = { dbLimitBytes: 500_000_000, d1RowsWrittenPerDay: 100_000, d1RowsReadPerDay: 5_000_000, workerRequestsPerDay: 100_000, aePointsPerDay: 100_000, ...T };
const health = (bytes, extra = {}) => ({ serverTime: 1, db: { bytes, limitBytes: 500_000_000, warnRatio: 0.7, guardRatio: 0.9 }, ingestPaused: false, ...extra });

test('parseCapacity reads the real CAPACITY in core/schema/limits.ts', () => {
  const cap = parseCapacity(readFileSync(join(TCE, 'core/schema/limits.ts'), 'utf8'));
  for (const k of CAPACITY_KEYS) assert.equal(typeof cap[k], 'number', k);
  assert.ok(cap.dbLimitBytes > 0 && cap.d1RowsWrittenPerDay > 0 && cap.d1RowsReadPerDay > 0 && cap.workerRequestsPerDay > 0);
  assert.ok(cap.warnRatio < cap.guardRatio);
});

test('parseCapacity handles underscores, decimals and comments; ignores other blocks', () => {
  const src = `
    export const LIMITS = { dbLimitBytes: 1 } as const;
    /** doc */
    export const CAPACITY = {
      dbLimitBytes: 500_000_000, // 500 MB
      /* block */ d1RowsWrittenPerDay: 100_000,
      d1RowsReadPerDay: 5_000_000,
      workerRequestsPerDay: 100_000,
      warnRatio: 0.7,
      guardRatio: 0.9
    } as const;`;
  assert.deepEqual(parseCapacity(src), { dbLimitBytes: 500_000_000, d1RowsWrittenPerDay: 100_000, d1RowsReadPerDay: 5_000_000, workerRequestsPerDay: 100_000, warnRatio: 0.7, guardRatio: 0.9 });
});

test('parseCapacity rejects a missing block, a missing key and inverted ratios', () => {
  assert.throws(() => parseCapacity('export const X = {} as const;'), /no `export const CAPACITY/);
  assert.throws(() => parseCapacity('export const CAPACITY = { dbLimitBytes: 1 } as const;'), /d1RowsWrittenPerDay/);
  const inverted = 'export const CAPACITY = { dbLimitBytes: 1, d1RowsWrittenPerDay: 1, d1RowsReadPerDay: 1, workerRequestsPerDay: 1, warnRatio: 0.9, guardRatio: 0.7 } as const;';
  assert.throws(() => parseCapacity(inverted), /warnRatio < guardRatio/);
});

test('levelOf: thresholds are inclusive; unknown without a finite ratio', () => {
  assert.equal(levelOf(0, T), 'ok');
  assert.equal(levelOf(0.6999, T), 'ok');
  assert.equal(levelOf(0.7, T), 'warn');
  assert.equal(levelOf(0.8999, T), 'warn');
  assert.equal(levelOf(0.9, T), 'critical');
  assert.equal(levelOf(1.5, T), 'critical');
  assert.equal(levelOf(null, T), 'unknown');
  assert.equal(levelOf(Number.NaN, T), 'unknown');
});

test('buildMetrics: health only gives storage with the live ratios', () => {
  const { thresholds, metrics } = buildMetrics({ capacity: CAP, health: health(123), cf: null });
  assert.deepEqual(thresholds, T);
  assert.deepEqual(metrics, [{ id: 'storage', label: 'D1 storage', unit: 'bytes', used: 123, limit: 500_000_000 }]);
});

test('buildMetrics: storage takes the larger figure; daily rows need CAPACITY; nulls are skipped', () => {
  const cf = { rowsRead: 10, rowsWritten: 20, requests: null, sizeBytes: 900 };
  const { metrics } = buildMetrics({ capacity: CAP, health: health(500), cf });
  assert.deepEqual(
    metrics.map((m) => [m.id, m.used, m.limit]),
    [
      ['storage', 900, 500_000_000],
      ['rowsWritten', 20, 100_000],
      ['rowsRead', 10, 5_000_000],
    ],
  );
  assert.deepEqual(buildMetrics({ capacity: null, health: health(null), cf }).metrics.map((m) => m.id), ['storage']);
});

test('buildMetrics: no health and no token means no metrics; CAPACITY still gives thresholds', () => {
  assert.deepEqual(buildMetrics({ capacity: CAP, health: null, cf: null }), { thresholds: T, metrics: [] });
  assert.deepEqual(buildMetrics({ capacity: null, health: null, cf: null }), { thresholds: null, metrics: [] });
});

test('evaluate adds ratio and level', () => {
  const [m] = evaluate([{ id: 'storage', label: 'D1 storage', unit: 'bytes', used: 360_000_000, limit: 500_000_000 }], T);
  assert.equal(m.ratio, 0.72);
  assert.equal(m.level, 'warn');
  assert.equal(evaluate([{ id: 'x', label: 'x', unit: 'count', used: null, limit: 10 }], T)[0].level, 'unknown');
});

test('formatting: counts, decimal bytes, percent', () => {
  assert.equal(formatCount(1_234_567), '1,234,567');
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(null), '?');
  assert.equal(formatBytes(500_000_000), '500 MB');
  assert.equal(formatBytes(360_123_456), '360.1 MB');
  assert.equal(formatBytes(1_500), '1.5 kB');
  assert.equal(formatBytes(12), '12 B');
  assert.equal(formatBytes(2e9), '2 GB');
  assert.equal(formatPercent(0.7234), '72.3%');
  assert.equal(formatPercent(null), '?');
});

test('renderTable aligns metric, used, limit, % and state', () => {
  const ev = evaluate(
    [
      { id: 'storage', label: 'D1 storage', unit: 'bytes', used: 455_000_000, limit: 500_000_000 },
      { id: 'rowsWritten', label: 'D1 rows written today (UTC)', unit: 'count', used: 1_200, limit: 100_000 },
    ],
    T,
  );
  const lines = renderTable(ev).split('\n');
  assert.match(lines[0], /^Metric\s+Used\s+Limit\s+%\s+State$/);
  assert.match(lines[1], /^-+ {2}-+ {2}-+ {2}-+ {2}-+$/);
  assert.match(lines[2], /^D1 storage\s+455 MB\s+500 MB\s+91\.0%\s+CRITICAL$/);
  assert.match(lines[3], /^D1 rows written today \(UTC\)\s+1,200\s+100,000\s+1\.2%\s+ok$/);
  assert.equal(new Set(lines.slice(2).map((l) => l.indexOf('%'))).size, 1, 'the % column is right-aligned');
});

test('findings: storage warns to plan the backup and points at the todo Backup section', () => {
  const [w] = findings(evaluate([{ id: 'storage', label: 'D1 storage', unit: 'bytes', used: 360_000_000, limit: 500_000_000 }], T), {}, T);
  assert.equal(w.level, 'warn');
  assert.ok(!w.text.startsWith('CRITICAL'));
  assert.match(w.text, /D1 storage at 72\.0% of the free plan's 500 MB \(360 MB\)/);
  assert.ok(w.text.includes(`Plan the backup now: ${BACKUP_PLAN}.`), w.text);
  assert.equal(BACKUP_PLAN, 'tce/docs/planning/todo.md, Backup section');
});

test('findings: CRITICAL at guardRatio, with the guard consequence', () => {
  const [w] = findings(evaluate([{ id: 'storage', label: 'D1 storage', unit: 'bytes', used: 450_000_000, limit: 500_000_000 }], T), {}, T);
  assert.equal(w.level, 'critical');
  assert.match(w.text, /^CRITICAL: D1 storage at 90\.0%/);
  assert.match(w.text, /refuses new telemetry from 90\.0%/);
  assert.ok(w.text.includes(`Build the backup now: ${BACKUP_PLAN}.`));
});

test('findings: daily metrics warn without the backup pointer; ok metrics say nothing', () => {
  const ev = evaluate(
    [
      { id: 'rowsWritten', label: 'D1 rows written today (UTC)', unit: 'count', used: 75_000, limit: 100_000 },
      { id: 'requests', label: 'Worker requests today (UTC)', unit: 'count', used: 10, limit: 100_000 },
    ],
    T,
  );
  const out = findings(ev, {}, T);
  assert.equal(out.length, 1);
  assert.match(out[0].text, /^D1 rows written today \(UTC\) at 75\.0% of the free plan's 100,000\/day \(75,000\); past 100% D1 refuses writes until 00:00 UTC\.$/);
});

test('findings: paused ingest is critical even below the thresholds', () => {
  const out = findings([], { ingestPaused: true }, T);
  assert.equal(out.length, 1);
  assert.equal(out[0].level, 'critical');
  assert.match(out[0].text, /^CRITICAL: the storage guard is refusing new telemetry/);
  assert.ok(out[0].text.includes(BACKUP_PLAN));
});

test('annotation escapes workflow-command data and properties', () => {
  assert.equal(annotation('at 72.0%: plan'), '::warning title=tce capacity::at 72.0%25: plan');
  assert.equal(annotation('a\r\nb'), '::warning title=tce capacity::a%0D%0Ab');
  assert.equal(annotation('x', 'a:b,c%'), '::warning title=a%3Ab%2Cc%25::x');
});

test('renderSummary writes a Markdown table, warnings and notes', () => {
  const ev = evaluate([{ id: 'storage', label: 'D1 | storage', unit: 'bytes', used: 1_000_000, limit: 500_000_000 }], T);
  const md = renderSummary(ev, [{ level: 'warn', text: 'health endpoint not deployed yet' }, { level: 'critical', text: 'CRITICAL: x' }], ['skipped']);
  assert.match(md, /^### TCE capacity \(free plan\)\n/);
  assert.ok(md.includes('| D1 \\| storage | 1 MB | 500 MB | 0.2% | ok |'));
  assert.ok(md.includes('- Warning: health endpoint not deployed yet\n'));
  assert.ok(md.includes('- CRITICAL: x\n'));
  assert.ok(md.endsWith('- skipped\n'));
  assert.ok(!renderSummary([], [], []).includes('| Metric'));
});

test('exitCode: 0 unless --strict and a metric at guardRatio or ingest paused', () => {
  const crit = evaluate([{ id: 'storage', label: 's', unit: 'bytes', used: 95, limit: 100 }], T);
  const warn = evaluate([{ id: 'storage', label: 's', unit: 'bytes', used: 75, limit: 100 }], T);
  assert.equal(exitCode({ strict: false, evaluated: crit, ingestPaused: true }), 0);
  assert.equal(exitCode({ strict: true, evaluated: crit, ingestPaused: false }), 1);
  assert.equal(exitCode({ strict: true, evaluated: warn, ingestPaused: false }), 0);
  assert.equal(exitCode({ strict: true, evaluated: [], ingestPaused: true }), 1);
  assert.equal(exitCode({ strict: true, evaluated: [], ingestPaused: false }), 0);
});
