#!/usr/bin/env node
// PhoneCanDo usage data from Cloudflare, read-only. Zero deps (node:* only).
//
//   node tce/scripts/data.mjs [--days N] [--testers] [--report | --json]
//   (./manage data; ./manage build and ./manage release print the report
//   after the limit check)
//
// In a terminal: a full-screen, interactive view (tabs, scrolling, error and
// report details, reload; ? lists the keys). Anywhere else, or with --report:
// the same screens as plain text, aggregates only (no report notes, logs or
// stack frames). --json prints the whole model, details included.
//
// Reads the D1 database of hosts/cloudflare/wrangler.jsonc with only SELECTs,
// through TCE_READ_TOKEN (or CLOUDFLARE_API_TOKEN) or else the logged-in cf
// CLI; Analytics Engine detail needs the token (scripts/data/source.mjs).
// TCE_READ_TOKEN and CLOUDFLARE_ACCOUNT_ID may sit in the repo-root .env (or
// the file PHONECANDO_RELEASE_ENV names); only those two keys are read.
// Every refresh is one D1 batch and its rows read count toward the free plan's
// 5M a day; the output says how many. Tester devices are left out unless
// --testers. Only on our own machines: it skips itself under GitHub Actions
// (public logs) and Workers Builds (usage data stays out of Cloudflare's build
// logs). A failed read exits 1; ./manage build and release go on regardless.
import { parseArgs } from 'node:util';
import { withEnvFile } from './data/env-file.mjs';
import { buildModel } from './data/model.mjs';
import { colorWanted, makeStyle } from './data/paint.mjs';
import { aeStatements, d1Statements } from './data/queries.mjs';
import { renderReport } from './data/report.mjs';
import { chooseSource, cliSource, tokenSource } from './data/source.mjs';
import { runTui } from './data/tui.mjs';
import { ROOT, d1DatabaseOf, readWranglerConfig } from './wrangler-config.mjs';

const HELP = `usage: node tce/scripts/data.mjs [--days N] [--testers] [--report | --json]

  Usage data from Cloudflare (D1, and Analytics Engine with a token), read-only.
  Interactive in a terminal; a plain report otherwise.

  --days N          window in UTC days, 1..365 (default 30; w cycles 7/30/90)
  --testers         include our own tester devices
  --report          print the plain report even in a terminal (aggregates only)
  --json            print the whole model as JSON (details included)
  TCE_READ_TOKEN    read-only API token (D1: Read, Account Analytics: Read),
                    from the environment or the repo-root .env (or the file
                    PHONECANDO_RELEASE_ENV names), or CLOUDFLARE_API_TOKEN;
                    without one the logged-in cf CLI is used (D1 only)
  CLOUDFLARE_ACCOUNT_ID  the account, when the token sees more than one
  -h --help         this text`;

let args;
try {
  args = parseArgs({
    options: {
      days: { type: 'string', default: '30' },
      testers: { type: 'boolean', default: false },
      report: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }).values;
} catch (e) {
  console.error(`data: ${e.message}\n\n${HELP}`);
  process.exit(2);
}
if (args.help) {
  console.log(HELP);
  process.exit(0);
}
const days = Number(args.days);
if (!Number.isInteger(days) || days < 1 || days > 365) {
  console.error(`data: --days must be a whole number from 1 to 365\n\n${HELP}`);
  process.exit(2);
}

const env = withEnvFile(process.env, ROOT);
const chosen = chooseSource(env);
if (chosen.skip) {
  console.log(`data: ${chosen.skip}`);
  process.exit(0);
}

let db;
let datasets;
try {
  const config = readWranglerConfig();
  db = d1DatabaseOf(config);
  datasets = Object.fromEntries((config.analytics_engine_datasets ?? []).map((d) => [d.binding, d.dataset]));
} catch (e) {
  console.log(`warning: data: ${e.message}`);
  process.exit(1);
}
const source = chosen.kind === 'token' ? tokenSource(chosen) : cliSource();

/** One refresh: the D1 batch and the Analytics Engine detail in parallel, as a model. */
async function load({ days: window, testers }) {
  const now = Date.now();
  const statements = d1Statements({ now, days: window, testers });
  const [d1, ae] = await Promise.all([
    source.d1(db.database_id, statements),
    source.ae(aeStatements({ days: window, pageviews: datasets.PAGEVIEWS, downloads: datasets.DOWNLOADS })).catch((e) => ({ results: {}, problem: e.message })),
  ]);
  return buildModel({ results: d1.results, ae, now, days: window, testers, source: source.label, database: db.database_name ?? db.database_id, rowsRead: d1.rowsRead });
}

const interactive = !args.report && !args.json && process.stdin.isTTY && process.stdout.isTTY && !env.CI;
if (interactive) {
  await runTui({ load, days, testers: args.testers, style: makeStyle(colorWanted(process.stdout)) });
} else {
  try {
    const model = await load({ days, testers: args.testers });
    if (args.json) console.log(JSON.stringify(model, null, 2));
    else console.log(renderReport(model, { w: Math.min(process.stdout.columns || 110, 130), style: makeStyle(colorWanted(process.stdout)) }));
  } catch (e) {
    console.log(`warning: data: ${e?.message ?? e}`);
    process.exitCode = 1;
  }
}
