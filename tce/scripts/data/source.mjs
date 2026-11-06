// Where scripts/data.mjs reads from, read-only:
//   - a token: TCE_READ_TOKEN (or CLOUDFLARE_API_TOKEN) with D1: Read, plus
//     Account Analytics: Read for the Analytics Engine detail, through
//     Cloudflare's REST API. The account is CLOUDFLARE_ACCOUNT_ID, or the
//     token's only account.
//   - else the logged-in `cf` CLI (`cf d1 query`), D1 only.
// It reads only on our own machines: never under GitHub Actions (public logs;
// usage data never goes to GitHub) or Workers Builds (usage data stays out of
// Cloudflare's build logs). The token goes only into the Authorization header;
// no message includes it. fetch and spawn are injected.

import { spawn as nodeSpawn } from 'node:child_process';
import { assertReadOnly } from './queries.mjs';

export const CF_API = 'https://api.cloudflare.com/client/v4';
const UA = 'phonecando-data';
const TIMEOUT_MS = 30_000;

/**
 * The backend for `env`: { kind: 'token', token, accountId } or { kind: 'cli' },
 * or { skip } with the reason when nothing may or can be read.
 */
export function chooseSource(env) {
  if (env.GITHUB_ACTIONS) return { skip: 'skipped under GitHub Actions: its logs are public, and usage data never goes to GitHub' };
  if (env.WORKERS_CI === '1') return { skip: 'skipped under Workers Builds: usage data stays out of Cloudflare build logs (run ./manage data)' };
  const token = (env.TCE_READ_TOKEN || env.CLOUDFLARE_API_TOKEN || '').trim();
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID || '').trim() || null;
  if (accountId && !/^[0-9a-f]{32}$/i.test(accountId)) return { skip: 'CLOUDFLARE_ACCOUNT_ID is not a 32-character hex account id' };
  return token ? { kind: 'token', token, accountId } : { kind: 'cli' };
}

const AUTH = /not authori[sz]ed|authenticat|permission|forbidden|unauthori[sz]ed/i;

/** First Cloudflare error messages of a JSON body, capped. */
function messagesOf(json) {
  const list = Array.isArray(json?.errors) ? json.errors : [];
  const text = list
    .slice(0, 2)
    .map((e) => (typeof e?.message === 'string' ? e.message : JSON.stringify(e)))
    .join('; ');
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

function explain(status, json, permission, fallback) {
  const msg = messagesOf(json) || (typeof json?.error === 'string' ? json.error : '') || fallback;
  const hint = status === 401 || status === 403 || AUTH.test(msg) ? ` (the token needs ${permission})` : '';
  return `${status && status !== 200 ? `HTTP ${status}: ` : ''}${msg}${hint}`;
}

/** Maps a D1 result array onto statement names; returns { results, rowsRead }. */
export function namedResults(statements, result) {
  if (!Array.isArray(result) || result.length !== statements.length) {
    throw new Error(`D1 returned ${Array.isArray(result) ? result.length : 'no'} result sets for ${statements.length} statements`);
  }
  const results = {};
  let rowsRead = 0;
  result.forEach((r, i) => {
    if (r?.success === false) throw new Error(`query "${statements[i].name}" failed: ${JSON.stringify(r.error ?? r).slice(0, 300)}`);
    results[statements[i].name] = r?.results ?? [];
    rowsRead += Number(r?.meta?.rows_read ?? 0);
  });
  return { results, rowsRead };
}

/** REST backend over a read-only token. */
export function tokenSource({ token, accountId }, { fetch: fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const headers = { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': UA };
  let account = accountId;

  async function call(path, init = {}) {
    let res;
    try {
      res = await fetchImpl(`${CF_API}${path}`, { ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      throw new Error(`request failed: ${e?.name === 'TimeoutError' ? `timed out after ${timeoutMs / 1000} s` : (e?.message ?? e)}`);
    }
    let json = null;
    try {
      json = await res.json();
    } catch {
      // An HTML error page: the status says enough.
    }
    return { status: res.status, json };
  }

  async function accountOf() {
    if (account) return account;
    const r = await call('/accounts?per_page=5');
    const list = Array.isArray(r.json?.result) ? r.json.result : [];
    if (r.status !== 200 || list.length !== 1) {
      // A token with only D1 and analytics read access usually cannot list accounts at all.
      throw new Error(
        list.length > 1
          ? 'the token sees several accounts: set CLOUDFLARE_ACCOUNT_ID (in .env; it is not a secret)'
          : 'the token cannot list accounts (normal for a read-only token): set CLOUDFLARE_ACCOUNT_ID in .env (dashboard → Account home → Account ID; not a secret)',
      );
    }
    account = list[0].id;
    return account;
  }

  return {
    label: 'API token',
    async d1(databaseId, statements) {
      assertReadOnly(statements);
      const id = await accountOf();
      const r = await call(`/accounts/${encodeURIComponent(id)}/d1/database/${encodeURIComponent(databaseId)}/query`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sql: statements.map((s) => s.sql).join(';\n') }),
      });
      if (r.status !== 200 || r.json?.success !== true) throw new Error(`D1: ${explain(r.status, r.json, 'D1: Read', 'query failed')}`);
      return namedResults(statements, r.json.result);
    },
    /** { results } or { problem }; one failed query does not hide the others. */
    async ae(statements) {
      assertReadOnly(statements);
      const id = await accountOf();
      const results = {};
      const problems = [];
      await Promise.all(
        statements.map(async (s) => {
          const r = await call(`/accounts/${encodeURIComponent(id)}/analytics_engine/sql`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: s.sql });
          if (r.status === 200 && Array.isArray(r.json?.data)) results[s.name] = r.json.data;
          else problems.push(explain(r.status, r.json, 'Account Analytics: Read', 'query failed'));
        }),
      );
      return problems.length ? { results, problem: `Analytics Engine: ${[...new Set(problems)][0]}` } : { results };
    },
  };
}

/** Runs `cf` with `args`; resolves { code, stdout, stderr }. */
function run(spawnImpl, args) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl('cf', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      reject(e);
      return;
    }
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

/** Backend over the logged-in cf CLI (D1 only: its login cannot query Analytics Engine). */
export function cliSource({ spawn: spawnImpl = nodeSpawn } = {}) {
  return {
    label: 'cf CLI',
    async d1(databaseId, statements) {
      assertReadOnly(statements);
      let r;
      try {
        r = await run(spawnImpl, ['d1', 'query', databaseId, '--sql', statements.map((s) => s.sql).join(';\n')]);
      } catch (e) {
        if (e?.code === 'ENOENT') throw new Error('the cf CLI is not on PATH (npm i -g cf, then cf auth login; with nvm, load it first), or set TCE_READ_TOKEN');
        throw e;
      }
      if (r.code !== 0) throw new Error(`cf d1 query exited ${r.code}: ${(r.stderr || r.stdout).trim().slice(0, 500)}`);
      let parsed;
      try {
        parsed = JSON.parse(r.stdout);
      } catch {
        throw new Error(`cf d1 query printed something other than JSON: ${r.stdout.slice(0, 300)}`);
      }
      return namedResults(statements, Array.isArray(parsed) ? parsed : parsed?.result);
    },
    async ae() {
      return { results: {}, problem: 'Analytics Engine detail needs TCE_READ_TOKEN (Account Analytics: Read); the cf CLI login cannot query it' };
    },
  };
}
