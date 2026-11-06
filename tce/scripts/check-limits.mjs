#!/usr/bin/env node
// Free-plan capacity check, run on every build. Zero deps (node:* only).
//
//   node tce/scripts/check-limits.mjs [--strict]
//   (./manage limits; ./manage build and ./manage release run it first; the
//   tce.yml capacity job; the Workers Builds build command)
//
// 1. GET ${TCE_BASE:-https://api.phonecando.app}/v1/health: the database size
//    against its limit, whether the storage guard is pausing ingest, and the
//    retention switch with the oldest kept row per table: while retention is
//    off, it warns 14 days before the age the privacy page promises
//    (retention-watch.mjs). A 404 means the endpoint is not deployed yet.
// 2. Only when CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are set (a
//    read-only token: Account Analytics: Read, plus D1: Read for the size):
//    today's (UTC) D1 rows read and written of the database in
//    hosts/cloudflare/wrangler.jsonc and the requests of the Worker it names,
//    from Cloudflare's GraphQL Analytics API, and the database size from the
//    D1 REST API. Skipped under Workers Builds (WORKERS_CI=1).
//
// Limits are CAPACITY in core/schema/limits.ts (read as text). A metric at
// warnRatio (70%) warns; at guardRatio (90%) the warning says CRITICAL. Under
// GitHub Actions each warning is a ::warning annotation and the table also goes
// to the job summary. Exits 0, network trouble included, unless --strict: then
// 1 when a metric is at guardRatio or ingest is paused. Never prints the token.
import { appendFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { annotation, buildMetrics, evaluate, exitCode, findings, formatPercent, parseCapacity, renderSummary, renderTable } from './capacity.mjs';
import { cloudflareSetup, fetchCloudflareUsage, fetchHealth } from './capacity-sources.mjs';
import { hasCritical, renderRetention, retentionFindings } from './retention-watch.mjs';
import { TCE, d1DatabaseOf, readWranglerConfig } from './wrangler-config.mjs';

const DEFAULT_BASE = 'https://api.phonecando.app';
const LIMITS_TS = join(TCE, 'core/schema/limits.ts');

const HELP = `usage: node tce/scripts/check-limits.mjs [--strict]

  Compares usage with the Cloudflare free plan (CAPACITY in
  tce/core/schema/limits.ts): warns at 70%, CRITICAL at 90%.

  TCE_BASE                 API host to ask for /v1/health (default ${DEFAULT_BASE})
  CLOUDFLARE_API_TOKEN     optional, read-only (Account Analytics: Read, D1: Read)
  CLOUDFLARE_ACCOUNT_ID    optional; with the token adds today's D1 rows and
                           Worker requests
  --strict                 exit 1 at 90% or while ingest is paused
  -h --help                this text`;

let args;
try {
  args = parseArgs({ options: { strict: { type: 'boolean', default: false }, help: { type: 'boolean', short: 'h', default: false } } }).values;
} catch (e) {
  console.error(`check-limits: ${e.message}\n\n${HELP}`);
  process.exit(2);
}
if (args.help) {
  console.log(HELP);
  process.exit(0);
}

/** Measures, prints and returns the exit code. */
async function main() {
  const env = process.env;
  const github = Boolean(env.GITHUB_ACTIONS);
  const problems = []; // become warnings: something could not be measured
  const notes = [];

  let capacity = null;
  try {
    capacity = parseCapacity(readFileSync(LIMITS_TS, 'utf8'));
  } catch (e) {
    problems.push(`could not read CAPACITY from tce/core/schema/limits.ts: ${e.message}`);
  }

  const base = (env.TCE_BASE || DEFAULT_BASE).trim().replace(/\/+$/, '');
  let baseOk = false;
  try {
    baseOk = ['https:', 'http:'].includes(new URL(base).protocol);
  } catch {
    // reported below
  }
  if (!baseOk) problems.push(`TCE_BASE is not an http(s) URL: ${base}`);

  const setup = cloudflareSetup(env, () => {
    const config = readWranglerConfig();
    if (typeof config.name !== 'string' || !config.name) throw new Error('no Worker name in hosts/cloudflare/wrangler.jsonc');
    return { databaseId: d1DatabaseOf(config).database_id, scriptName: config.name };
  });
  if (setup.skip) notes.push(setup.skip);
  if (setup.problem) problems.push(setup.problem);

  const [healthResult, usage] = await Promise.all([
    baseOk ? fetchHealth(base) : Promise.resolve(null),
    setup.query ? fetchCloudflareUsage(setup.query) : Promise.resolve(null),
  ]);

  const health = healthResult?.ok ? healthResult.health : null;
  if (healthResult && !healthResult.ok) problems.push(healthResult.problem);
  if (health && health.db.bytes === null) notes.push('the Worker cannot tell the database size (health db.bytes is null)');

  let cf = null;
  if (usage) {
    cf = {
      rowsRead: usage.d1.ok ? usage.d1.values.rowsRead : null,
      rowsWritten: usage.d1.ok ? usage.d1.values.rowsWritten : null,
      requests: usage.worker.ok ? usage.worker.values.requests : null,
      sizeBytes: usage.size.ok ? usage.size.bytes : null,
    };
    if (!usage.d1.ok) problems.push(`Cloudflare D1 analytics: ${usage.d1.problem}`);
    if (!usage.worker.ok) problems.push(`Cloudflare Worker analytics: ${usage.worker.problem}`);
    if (!usage.size.ok) problems.push(`Cloudflare D1 size: ${usage.size.problem}`);
  }

  const { thresholds, metrics } = buildMetrics({ capacity, health, cf });
  const evaluated = thresholds ? evaluate(metrics, thresholds) : [];
  const ingestPaused = health?.ingestPaused === true;
  const retention = health ? retentionFindings(health.retention) : [];
  const warnings = [
    ...(thresholds ? findings(evaluated, { ingestPaused }, thresholds) : []),
    ...retention,
    ...problems.map((text) => ({ level: 'warn', text })),
  ];

  const day = new Date().toISOString().slice(0, 10);
  console.log(`TCE capacity · ${base} · ${day} (UTC)\n`);
  if (evaluated.length) console.log(renderTable(evaluated));
  else console.log('No usage figures available.');
  if (health) {
    console.log(
      `\nIngest: ${ingestPaused ? 'PAUSED by the storage guard' : 'accepting'} (warn at ${formatPercent(thresholds.warnRatio)}, guard at ${formatPercent(thresholds.guardRatio)})`,
    );
    console.log(renderRetention(health.retention));
  }
  console.log('');
  for (const w of warnings) console.log(github ? annotation(w.text) : `${w.level === 'critical' ? '' : 'warning: '}${w.text}`);
  for (const n of notes) console.log(`note: ${n}`);

  if (github && env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(env.GITHUB_STEP_SUMMARY, renderSummary(evaluated, warnings, notes));
    } catch (e) {
      console.log(`note: could not write the job summary: ${e.message}`);
    }
  }

  const retentionExit = args.strict && hasCritical(retention) ? 1 : 0;
  return Math.max(exitCode({ strict: args.strict, evaluated, ingestPaused }), retentionExit);
}

// Why catch everything: a bug here must never block a build (exit 0 without --strict).
try {
  process.exitCode = await main();
} catch (e) {
  console.log(`warning: check-limits failed: ${e?.stack ?? e}`);
  process.exitCode = args.strict ? 1 : 0;
}
