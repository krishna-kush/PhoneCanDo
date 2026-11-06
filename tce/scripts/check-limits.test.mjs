// End-to-end tests for scripts/check-limits.mjs: the real CLI against a local
// health server, with Cloudflare's API stubbed inside the child process (no
// network beyond 127.0.0.1, no real token).
//   node --test tce/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./check-limits.mjs', import.meta.url));
const TOKEN = 'tok_SECRET_value_never_printed';
const ACCOUNT = '0123456789abcdef0123456789abcdef';

let server;
let base;
let health = { status: 404, body: { error: { code: 'not_found', message: 'no route' } } };

before(async () => {
  server = createServer((req, res) => {
    if (req.url !== '/v1/health') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(health.status, { 'content-type': 'application/json' }).end(JSON.stringify(health.body));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const healthBody = (bytes, ingestPaused = false) => ({
  status: 200,
  body: { serverTime: 1, db: { bytes, limitBytes: 500_000_000, warnRatio: 0.7, guardRatio: 0.9 }, ingestPaused },
});

// Replaces fetch for api.cloudflare.com inside the child; other URLs use the real fetch.
const STUB = `
const real = globalThis.fetch;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  if (!u.startsWith('https://api.cloudflare.com/')) return real(url, init);
  if (process.env.STUB_CF_FORBID) throw new Error('Cloudflare must not be called');
  if (init.headers?.authorization !== 'Bearer ${TOKEN}') return json(401, { errors: [{ message: 'bad auth' }] });
  if (u.endsWith('/graphql')) {
    const { query } = JSON.parse(init.body);
    if (query.includes('d1AnalyticsAdaptiveGroups')) {
      return json(200, { data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 4000000, rowsWritten: 75000 } }] }] } }, errors: null });
    }
    return json(200, { data: null, errors: [{ message: 'not authorized for that account' }] });
  }
  return json(200, { success: true, errors: [], result: { file_size: 1000000 } });
};`;

/** Runs the CLI; resolves { code, out } (stdout + stderr). */
function run(args = [], env = {}) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^(CLOUDFLARE_|WORKERS_CI|GITHUB_ACTIONS|GITHUB_STEP_SUMMARY|TCE_BASE)/.test(k)),
  );
  const child = spawn(process.execPath, [`--import=data:text/javascript,${encodeURIComponent(STUB)}`, SCRIPT, ...args], {
    env: { ...clean, TCE_BASE: base, ...env },
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  return new Promise((resolve) => child.on('close', (code) => resolve({ code, out })));
}

test('404: "health endpoint not deployed yet", exit 0, even with --strict', async () => {
  health = { status: 404, body: { error: { code: 'not_found', message: 'no route' } } };
  for (const args of [[], ['--strict']]) {
    const { code, out } = await run(args);
    assert.equal(code, 0, out);
    assert.match(out, /No usage figures available\./);
    assert.match(out, /^warning: health endpoint not deployed yet \(GET http:\/\/127\.0\.0\.1:\d+\/v1\/health answered 404\)$/m);
    assert.match(out, /^note: Cloudflare usage: skipped \(set CLOUDFLARE_API_TOKEN/m);
  }
});

test('unreachable host: a warning, exit 0', async () => {
  const { code, out } = await run(['--strict'], { TCE_BASE: 'http://127.0.0.1:9' });
  assert.equal(code, 0, out);
  assert.match(out, /^warning: health check failed: GET http:\/\/127\.0\.0\.1:9\/v1\/health: /m);
});

test('72% storage under GitHub Actions: warning annotation pointing at the backup plan, and a job summary', async () => {
  health = healthBody(360_000_000);
  const dir = mkdtempSync(join(tmpdir(), 'check-limits-'));
  try {
    const summary = join(dir, 'summary.md');
    const { code, out } = await run([], { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: summary });
    assert.equal(code, 0, out);
    assert.match(out, /^D1 storage\s+360 MB\s+500 MB\s+72\.0%\s+WARN$/m);
    assert.match(out, /^Ingest: accepting \(warn at 70\.0%, guard at 90\.0%\)$/m);
    assert.match(
      out,
      /^::warning title=tce capacity::D1 storage at 72\.0%25 of the free plan's 500 MB \(360 MB\); .*Plan the backup now: tce\/docs\/planning\/todo\.md, Backup section\.$/m,
    );
    const md = readFileSync(summary, 'utf8');
    assert.match(md, /\| D1 storage \| 360 MB \| 500 MB \| 72\.0% \| WARN \|/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('91% and paused ingest: CRITICAL; exit 1 only with --strict', async () => {
  health = healthBody(455_000_000, true);
  const plain = await run();
  assert.equal(plain.code, 0, plain.out);
  assert.match(plain.out, /^CRITICAL: D1 storage at 91\.0% .*Build the backup now: tce\/docs\/planning\/todo\.md, Backup section\.$/m);
  assert.match(plain.out, /^CRITICAL: the storage guard is refusing new telemetry/m);
  assert.match(plain.out, /^Ingest: PAUSED by the storage guard/m);
  const strict = await run(['--strict']);
  assert.equal(strict.code, 1, strict.out);
});

test('below the thresholds: ok rows, no warnings, --strict exits 0', async () => {
  health = healthBody(1_000_000);
  const { code, out } = await run(['--strict']);
  assert.equal(code, 0, out);
  assert.match(out, /^D1 storage\s+1 MB\s+500 MB\s+0\.2%\s+ok$/m);
  assert.doesNotMatch(out, /^(warning|CRITICAL)/m);
});

test('with a token: daily D1 rows and the REST size join the table; a denied part warns; the token never prints', async () => {
  health = healthBody(900_000);
  const { code, out } = await run([], { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT });
  assert.equal(code, 0, out);
  assert.match(out, /^D1 storage\s+1 MB\s+500 MB\s+0\.2%\s+ok$/m, 'storage takes the larger figure (REST 1 MB > health 0.9 MB)');
  assert.match(out, /^D1 rows written today \(UTC\)\s+75,000\s+100,000\s+75\.0%\s+WARN$/m);
  assert.match(out, /^D1 rows read today \(UTC\)\s+4,000,000\s+5,000,000\s+80\.0%\s+WARN$/m);
  assert.doesNotMatch(out, /Worker requests today/);
  assert.match(out, /^warning: D1 rows written today \(UTC\) at 75\.0% of the free plan's 100,000\/day \(75,000\)/m);
  assert.match(out, /^warning: Cloudflare Worker analytics: not authorized for that account \(the token needs Account Analytics: Read\)$/m);
  assert.ok(!out.includes(TOKEN), 'the token is never printed');
});

test('Workers Builds: health only, Cloudflare is never called', async () => {
  health = healthBody(1_000_000);
  const { code, out } = await run([], { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT, WORKERS_CI: '1', STUB_CF_FORBID: '1' });
  assert.equal(code, 0, out);
  assert.match(out, /^note: Cloudflare usage: skipped under Workers Builds \(health only\)$/m);
  assert.doesNotMatch(out, /must not be called/);
});

test('--help prints usage; an unknown flag exits 2', async () => {
  const help = await run(['--help']);
  assert.equal(help.code, 0);
  assert.match(help.out, /^usage: node tce\/scripts\/check-limits\.mjs \[--strict\]/);
  const bad = await run(['--nope']);
  assert.equal(bad.code, 2);
});
