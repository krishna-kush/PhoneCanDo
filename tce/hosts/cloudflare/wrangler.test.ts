// Guards hosts/cloudflare/wrangler.jsonc: every key is valid for the pinned
// wrangler, wrangler itself reads it cleanly, and the parts that must agree
// with the code (crons, run_worker_first, bindings, migrations) do.

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';
import { unstable_readConfig } from 'wrangler';

import { cronOps, httpOps } from '../../core/ops/registry.ts';
import { isOpPath, OP_PATH_PREFIXES, parseOriginList } from '../../core/http.ts';
import { RATE_LIMIT_BINDINGS } from './config.ts';
import type { Env } from './config.ts';

const CONFIG_PATH = fileURLToPath(new URL('./wrangler.jsonc', import.meta.url));
const HERE = dirname(CONFIG_PATH);
const TCE = resolve(HERE, '../..');
const REPO = resolve(TCE, '..');
const SCHEMA_PATH = resolve(TCE, 'node_modules/wrangler/config-schema.json');

interface RawConfig {
  $schema: string;
  name: string;
  main: string;
  compatibility_date: string;
  assets: { directory: string; binding: string; not_found_handling: string; run_worker_first: string[] };
  d1_databases: Array<{ binding: string; database_name: string; database_id?: string; migrations_dir: string }>;
  analytics_engine_datasets: Array<{ binding: string; dataset: string }>;
  ratelimits: Array<{ name: string; namespace_id: string; simple: { limit: number; period: number } }>;
  triggers: { crons: string[] };
  observability: { enabled: boolean; logs: { enabled: boolean; invocation_logs: boolean } };
  vars: Record<string, string>;
  [key: string]: unknown;
}

/** JSON with // and block comments (strings are respected). */
function parseJsonc(text: string): unknown {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
      assert.ok(i > 0, 'unterminated block comment');
    } else {
      out += c;
    }
  }
  return JSON.parse(out);
}

interface Schema {
  $ref?: string;
  type?: string | string[];
  properties?: Record<string, Schema>;
  additionalProperties?: boolean | Schema;
  items?: Schema | Schema[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  allOf?: Schema[];
  enum?: unknown[];
  const?: unknown;
  required?: string[];
}

/** The subset of JSON Schema that wrangler's config-schema.json uses. */
function validate(value: unknown, schema: Schema, at: string, defs: Record<string, Schema>, errors: string[]): void {
  if (schema.$ref) {
    const name = schema.$ref.replace('#/definitions/', '');
    const target = defs[name];
    if (!target) errors.push(`${at}: unresolvable $ref ${schema.$ref}`);
    else validate(value, target, at, defs, errors);
    return;
  }
  for (const part of schema.allOf ?? []) validate(value, part, at, defs, errors);
  const branches = schema.anyOf ?? schema.oneOf;
  if (branches) {
    const fits = branches.some((b) => {
      const e: string[] = [];
      validate(value, b, at, defs, e);
      return e.length === 0;
    });
    if (!fits) errors.push(`${at}: matches no allowed shape`);
    return;
  }
  if (schema.enum && !schema.enum.some((v) => v === value)) errors.push(`${at}: ${JSON.stringify(value)} not in ${JSON.stringify(schema.enum)}`);
  if ('const' in schema && schema.const !== value) errors.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const ok = types.some((t) => t === actual || (t === 'integer' && Number.isInteger(value)));
    if (!ok) {
      errors.push(`${at}: expected ${types.join('|')}, got ${actual}`);
      return;
    }
  }
  if (Array.isArray(value) && schema.items) {
    value.forEach((v, i) => {
      const item = Array.isArray(schema.items) ? schema.items[i] : schema.items;
      if (item) validate(v, item, `${at}[${i}]`, defs, errors);
    });
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) if (!(key in obj)) errors.push(`${at}: missing required '${key}'`);
    for (const [key, v] of Object.entries(obj)) {
      const prop = schema.properties?.[key];
      if (prop) validate(v, prop, `${at}.${key}`, defs, errors);
      else if (schema.additionalProperties === false) errors.push(`${at}: unknown key '${key}'`);
      else if (typeof schema.additionalProperties === 'object') validate(v, schema.additionalProperties, `${at}.${key}`, defs, errors);
    }
  }
}

/** wrangler's run_worker_first glob: `*` matches anything, including '/'. */
function globMatches(pattern: string, path: string): boolean {
  const re = new RegExp(`^${pattern.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(path);
}

const raw = parseJsonc(readFileSync(CONFIG_PATH, 'utf8')) as RawConfig;

describe('hosts/cloudflare/wrangler.jsonc', () => {
  it('validates against the pinned wrangler config schema', () => {
    assert.equal(resolve(HERE, raw.$schema), SCHEMA_PATH, '$schema points at the installed wrangler schema');
    const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as Schema & { definitions: Record<string, Schema> };
    const errors: string[] = [];
    validate(raw, schema, 'config', schema.definitions, errors);
    assert.deepEqual(errors, []);
  });

  it('is read by wrangler without warnings', () => {
    const printed: string[] = [];
    const capture = (...args: unknown[]): void => {
      printed.push(args.map(String).join(' '));
    };
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => mock.method(console, m, capture));
    let config: ReturnType<typeof unstable_readConfig>;
    try {
      config = unstable_readConfig({ config: CONFIG_PATH });
    } finally {
      for (const s of spies) s.mock.restore();
    }
    assert.deepEqual(printed.filter((l) => /warn|error|unexpected|deprecated/i.test(l)), []);
    assert.equal(config.name, 'phonecando');
    assert.equal(config.compatibility_date, '2026-11-01');
    assert.deepEqual(config.triggers.crons, raw.triggers.crons);
    assert.equal(config.observability?.enabled, true);
    const limits = (list: RawConfig['ratelimits']) => list.map((r) => [r.name, r.namespace_id, r.simple.limit, r.simple.period]);
    assert.deepEqual(limits(config.ratelimits), limits(raw.ratelimits));
  });

  it('keeps the existing Worker identity and adds no routes', () => {
    assert.equal(raw.name, 'phonecando');
    assert.equal(raw.compatibility_date, '2026-11-01');
    assert.equal(raw.main, 'index.ts');
    assert.ok(existsSync(resolve(HERE, raw.main)));
    for (const key of ['route', 'routes', 'workers_dev', 'preview_urls', 'account_id']) {
      assert.ok(!(key in raw), `${key} must stay out of the config (domains are managed outside it)`);
    }
  });

  it('declares exactly the cron schedules of core/ops/registry.ts', () => {
    const fromOps = [...new Set(cronOps.map((op) => op.schedule))].sort();
    assert.deepEqual([...raw.triggers.crons].sort(), fromOps);
    // Only the GitHub counters run on a schedule; retention is not scheduled while we keep all data.
    assert.deepEqual(raw.triggers.crons, ['17 3 * * *']);
    assert.deepEqual(Object.fromEntries(cronOps.map((op) => [op.name, op.schedule])), { github_daily: '17 3 * * *' });
  });

  it('declares the three rate limiters the host maps every http op to', () => {
    assert.deepEqual(raw.ratelimits, [
      { name: 'RL_INGEST', namespace_id: '1001', simple: { limit: 6, period: 60 } },
      { name: 'RL_RARE', namespace_id: '1002', simple: { limit: 3, period: 60 } },
      { name: 'RL_PUBLIC', namespace_id: '1003', simple: { limit: 30, period: 60 } },
    ]);
    const declared = new Set(raw.ratelimits.map((r) => r.name));
    assert.equal(declared.size, raw.ratelimits.length, 'binding names are unique');
    assert.equal(new Set(raw.ratelimits.map((r) => r.namespace_id)).size, raw.ratelimits.length, 'namespaces are unique');
    for (const r of raw.ratelimits) {
      assert.match(r.namespace_id, /^\d+$/, 'namespace_id is a positive integer string');
      assert.ok(Number.isInteger(r.simple.limit) && r.simple.limit > 0);
      assert.ok([10, 60].includes(r.simple.period));
    }
    // Every http op has a limiter, and every limiter it names is declared (and typed in Env).
    for (const op of httpOps) {
      const binding = RATE_LIMIT_BINDINGS[op.name];
      assert.ok(binding !== undefined, `${op.name} has no rate limiter in RATE_LIMIT_BINDINGS`);
      assert.ok(declared.has(binding), `${binding} (for ${op.name}) is not in wrangler.jsonc ratelimits`);
    }
    assert.deepEqual([...new Set(Object.values(RATE_LIMIT_BINDINGS))].sort(), [...declared].sort(), 'no unused limiter');
    const typed: Array<keyof Env> = ['RL_INGEST', 'RL_RARE', 'RL_PUBLIC'];
    assert.deepEqual(typed.sort(), [...declared].sort());
  });

  it('routes every http op path to the Worker before assets', () => {
    const patterns = raw.assets.run_worker_first;
    assert.deepEqual([...patterns].sort(), OP_PATH_PREFIXES.map((p) => `${p}*`).sort());
    assert.ok(httpOps.length > 0);
    for (const op of httpOps) {
      const sample = op.path.replace(/:[^/]+/g, 'sample');
      assert.ok(
        patterns.some((p) => globMatches(p, sample)),
        `${op.method} ${op.path} is not in assets.run_worker_first`,
      );
      assert.ok(isOpPath(sample), `${op.path} is outside OP_PATH_PREFIXES`);
    }
  });

  it('serves web/dist through the ASSETS binding with the 404 page', () => {
    assert.equal(resolve(HERE, raw.assets.directory), resolve(REPO, 'web/dist'));
    assert.equal(raw.assets.binding, 'ASSETS');
    assert.equal(raw.assets.not_found_handling, '404-page');
  });

  it('binds D1 and Analytics Engine under the names the store expects, and no R2 bucket', () => {
    assert.equal(raw.d1_databases.length, 1);
    const db = raw.d1_databases[0]!;
    assert.equal(db.binding, 'DB');
    assert.equal(db.database_name, 'phonecando-stats');
    if (db.database_id !== undefined) assert.match(db.database_id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    const migrations = resolve(HERE, db.migrations_dir);
    assert.equal(migrations, resolve(TCE, 'stores/sql/migrations'));
    const files = readdirSync(migrations).filter((f) => f.endsWith('.sql')).sort();
    assert.deepEqual(files.slice(0, 3), ['0001_init.sql', '0002_ownership_indexes.sql', '0003_site_daily.sql']);
    for (const f of files) assert.match(f, /^\d{4}_[a-z0-9_]+\.sql$/, 'wrangler applies migrations in file-name order');

    assert.deepEqual(raw.analytics_engine_datasets, [
      { binding: 'PAGEVIEWS', dataset: 'phonecando_pageviews' },
      { binding: 'DOWNLOADS', dataset: 'phonecando_downloads' },
    ]);
    // Cold storage was removed: no bucket, and no leftover R2 hint in the file either.
    assert.ok(!('r2_buckets' in raw), 'r2_buckets must stay out of the config');
    assert.doesNotMatch(readFileSync(CONFIG_PATH, 'utf8'), /r2_buckets|ARCHIVE|\bR2\b/);
  });

  it('turns on Workers Logs and allows the site origins to post hits', () => {
    // Invocation logs would persist request headers (client IP); they must stay off.
    assert.deepEqual(raw.observability, { enabled: true, logs: { enabled: true, invocation_logs: false } });
    assert.deepEqual(parseOriginList(raw.vars['ALLOWED_ORIGINS']), [
      'https://phonecando.app',
      'https://phonecando.krishnakumarkush.workers.dev',
    ]);
  });

  it('answers the API on api.phonecando.app only', () => {
    // The host the app and the site call; every other host keeps /v1/* for the static site.
    assert.equal(raw.vars['API_HOSTS'], 'api.phonecando.app');
  });

  it('ships with retention off (we keep all data until the backup exists)', () => {
    // Turning it on is a deliberate edit to "true"; scripts/check-limits.mjs
    // warns before the oldest row passes the age the privacy page promises.
    assert.equal(raw.vars['RETENTION_ENABLED'], 'false');
  });
});
