// End-to-end tests for scripts/data.mjs: the real CLI with Cloudflare's API
// stubbed inside the child (data/fetch-stub.test-support.mjs; no network, no
// real token). Children have no TTY, so they print the plain report.
//   node --test tce/scripts/*.test.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { d1Statements } from './data/queries.mjs';
import { FRAME, LOG, NOTE } from './data/sample.test-support.mjs';

const SCRIPT = fileURLToPath(new URL('./data.mjs', import.meta.url));
const STUB = new URL('./data/fetch-stub.test-support.mjs', import.meta.url).href;
const TOKEN = 'tok_SECRET_value_never_printed';
const ACCOUNT = '0123456789abcdef0123456789abcdef';
const STATEMENTS = d1Statements({ now: Date.now(), days: 30 }).length;

/** Runs the CLI; resolves { code, out } (stdout + stderr). */
function run(args = [], env = {}) {
  const clean = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !/^(CLOUDFLARE_|TCE_READ_TOKEN|PHONECANDO_|WORKERS_CI|GITHUB_ACTIONS|CI$|FORCE_COLOR|NO_COLOR)/.test(k)),
  );
  // Why the missing env file: a real repo-root .env must never feed these runs.
  const child = spawn(process.execPath, [`--import=${STUB}`, SCRIPT, ...args], {
    env: { ...clean, STUB_TOKEN: TOKEN, PHONECANDO_RELEASE_ENV: join(tmpdir(), 'tce-data-test-no-such.env'), ...env },
  });
  let out = '';
  child.stdout.on('data', (d) => (out += d));
  child.stderr.on('data', (d) => (out += d));
  return new Promise((resolve) => child.on('close', (code) => resolve({ code, out })));
}

const withToken = { TCE_READ_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: ACCOUNT };

test('with a read token: the full report, aggregates only, nothing secret', async () => {
  const { code, out } = await run(['--report'], withToken);
  assert.equal(code, 0, out);
  assert.match(out, /^TCE usage data$/m);
  assert.match(out, new RegExp(`via API token · last 30 days .* · testers left out · ${(STATEMENTS * 10).toLocaleString('en-US')} rows read`));
  assert.match(out, /Google Pixel 9/); // the Devices tab
  assert.match(out, /news\.ycombinator\.com/); // Analytics Engine detail
  for (const secret of [TOKEN, NOTE, FRAME, ...LOG.split('\n')]) assert.ok(!out.includes(secret), `leaked: ${secret}`);
});

test('the token from the env file; nothing else in it is read or printed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tce-data-env-'));
  const file = join(dir, '.env');
  try {
    writeFileSync(file, `PHONECANDO_STORE_PASSWORD=signing_SECRET_value\nexport TCE_READ_TOKEN="${TOKEN}"\nCLOUDFLARE_ACCOUNT_ID=${ACCOUNT}\n`);
    const { code, out } = await run(['--report'], { PHONECANDO_RELEASE_ENV: file });
    assert.equal(code, 0, out);
    assert.match(out, /via API token/);
    assert.ok(!out.includes(TOKEN) && !out.includes('signing_SECRET_value'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('no TTY means the report, without --report', async () => {
  const { code, out } = await run([], withToken);
  assert.equal(code, 0, out);
  assert.match(out, /^▌ OVERVIEW$/m);
});

test('--json carries the details for local use', async () => {
  const { code, out } = await run(['--json', '--days', '7'], withToken);
  assert.equal(code, 0, out);
  const model = JSON.parse(out);
  assert.equal(model.meta.days, 7);
  assert.equal(model.reports[0].note, NOTE);
  assert.ok(!out.includes(TOKEN));
});

test('GitHub Actions never reads (public logs)', async () => {
  const { code, out } = await run(['--report'], { ...withToken, GITHUB_ACTIONS: 'true', STUB_CF: 'forbid' });
  assert.equal(code, 0, out);
  assert.match(out, /^data: skipped under GitHub Actions/m);
});

test('Workers Builds never reads, even with a token (data stays out of Cloudflare build logs)', async () => {
  const { code, out } = await run([], { ...withToken, WORKERS_CI: '1', STUB_CF: 'forbid' });
  assert.equal(code, 0, out);
  assert.match(out, /^data: skipped under Workers Builds/m);
});

test('a token without D1 access: a warning naming the permission, exit 1', async () => {
  const { code, out } = await run(['--report'], { ...withToken, STUB_CF: 'deny' });
  assert.equal(code, 1, out);
  assert.match(out, /^warning: data: D1: HTTP 403: Authentication error \(the token needs D1: Read\)$/m);
  assert.ok(!out.includes(TOKEN));
});

test('bad arguments exit 2 with the usage', async () => {
  for (const args of [['--days', '0'], ['--days', 'abc'], ['--nope']]) {
    const { code, out } = await run(args, withToken);
    assert.equal(code, 2, out);
    assert.match(out, /usage: node tce\/scripts\/data\.mjs/);
  }
});
