// What the stores/cloudflare test files share: one local D1 from wrangler's
// getPlatformProxy (workerd + local D1 persisted into a temp dir; no account,
// no network) with every shared migration applied in file order, a reset
// between cases, and recording fakes for Analytics Engine (it has no local
// emulation). Test-only: nothing in stores/cloudflare imports it.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after } from 'node:test';
import { getPlatformProxy } from 'wrangler';
import type { Logger } from '../../core/op.ts';
import type { TableName } from '../../core/schema/rows.ts';
import { splitSqlStatements } from '../sql/split.ts';
import { SHARED_MIGRATIONS_DIR, loadMigrations } from '../sqlite/migrate.ts';

// No usage metrics from the test run.
process.env.WRANGLER_SEND_METRICS ??= 'false';

const persist = mkdtempSync(join(tmpdir(), 'tce-cf-'));
const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath: fileURLToPath(new URL('./test/wrangler.test.jsonc', import.meta.url)),
  persist: { path: persist },
  remoteBindings: false,
  envFiles: [],
});
after(async () => {
  await proxy.dispose();
  rmSync(persist, { recursive: true, force: true });
});

/** The local D1 binding every case of the importing file shares. */
export const DB: D1Database = proxy.env.DB;

/** Every shared migration (0001, 0002, 0003, ...), in the order wrangler applies them. */
export const MIGRATIONS = loadMigrations(SHARED_MIGRATIONS_DIR);
// Each migration as one batch, statement by statement (D1's exec() splits on newlines).
for (const m of MIGRATIONS) await DB.batch(splitSqlStatements(m.sql).map((sql) => DB.prepare(sql)));

/** Every table the shared migrations create. */
export const TABLES: readonly TableName[] = [
  'devices',
  'installs',
  'sessions',
  'events',
  'errors',
  'reports',
  'github_assets_daily',
  'github_repo_daily',
  'site_daily',
];

/** Empty every table, so each case starts from a clean database. */
export async function reset(): Promise<void> {
  await DB.batch(TABLES.map((t) => DB.prepare(`DELETE FROM ${t}`)));
}

/** Rows of `SELECT count(*)` for a table. */
export async function count(table: string): Promise<number> {
  return (await DB.prepare(`SELECT count(*) AS n FROM ${table}`).first<number>('n')) ?? -1;
}

/** Analytics Engine dataset fake that records every data point. */
export function recordingDataset(): AnalyticsEngineDataset & { points: AnalyticsEngineDataPoint[] } {
  const points: AnalyticsEngineDataPoint[] = [];
  return {
    points,
    writeDataPoint(p?: AnalyticsEngineDataPoint) {
      if (p) points.push(p);
    },
  };
}

/** Analytics Engine dataset fake whose every write throws. */
export function failingDataset(message = 'AE down'): AnalyticsEngineDataset {
  return {
    writeDataPoint() {
      throw new Error(message);
    },
  };
}

/** Logger that keeps error lines (message plus the error field) and warning messages. */
export function memoryLog(): Logger & { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  return {
    errors,
    warnings,
    info() {},
    warn: (m) => void warnings.push(m),
    error: (m, d) => void errors.push(`${m} ${String(d?.error)}`),
  };
}

/** Verifiers for the two fixture devices in the D1-specific cases. */
export const V1 = '0a'.repeat(32);
export const V2 = '0b'.repeat(32);
