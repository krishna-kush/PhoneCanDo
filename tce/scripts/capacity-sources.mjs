// Usage sources for scripts/check-limits.mjs: the Worker's public
// GET /v1/health and, with a read-only token, Cloudflare's GraphQL Analytics
// API (today's D1 rows, Worker requests) and D1 REST API (database size).
// Fetch is injected and nothing here throws: every call resolves to
// { ok: true, ... } or { ok: false, problem }. The token goes only into the
// Authorization header; no message ever includes it.

/** Cloudflare API base. */
export const CF_API = 'https://api.cloudflare.com/client/v4';
/** Per-request timeout. */
export const TIMEOUT_MS = 10_000;
const UA = 'phonecando-check-limits';

// Dataset and field names as documented (developers.cloudflare.com: D1
// "Metrics and analytics", Analytics "Querying Workers Metrics with GraphQL";
// wrangler's own `d1 info` reads the same d1AnalyticsAdaptiveGroups sums and
// the REST `file_size`). Variable types follow those docs.
/** Today's rows read and written for one database. */
export const D1_QUERY = `query TceD1Usage($accountTag: string!, $start: Date, $end: Date, $databaseId: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      d1AnalyticsAdaptiveGroups(limit: 10000, filter: { date_geq: $start, date_leq: $end, databaseId: $databaseId }) {
        sum { rowsRead rowsWritten }
      }
    }
  }
}`;

/** Today's requests for one Worker script. */
export const WORKER_QUERY = `query TceWorkerUsage($accountTag: string!, $datetimeStart: string, $datetimeEnd: string, $scriptName: string) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      workersInvocationsAdaptive(limit: 10000, filter: { scriptName: $scriptName, datetime_geq: $datetimeStart, datetime_leq: $datetimeEnd }) {
        sum { requests }
      }
    }
  }
}`;

/** A fetch failure as one short line ("timed out after 10 s", "fetch failed (ENOTFOUND)"). */
export function errorText(e, timeoutMs = TIMEOUT_MS) {
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return `timed out after ${timeoutMs >= 1000 ? `${Math.round(timeoutMs / 1000)} s` : `${timeoutMs} ms`}`;
  const code = e?.cause?.code ?? e?.code;
  return `${e?.message ?? String(e)}${code ? ` (${code})` : ''}`;
}

const isRatio = (v) => typeof v === 'number' && v > 0 && v <= 1;

/** A HealthResponse (core/schema/wire.ts) when `body` has its shape, else null. */
export function parseHealth(body) {
  const db = body?.db;
  if (typeof body?.serverTime !== 'number' || typeof body?.ingestPaused !== 'boolean' || !db) return null;
  if (!(db.bytes === null || (typeof db.bytes === 'number' && db.bytes >= 0))) return null;
  if (!(typeof db.limitBytes === 'number' && db.limitBytes > 0) || !isRatio(db.warnRatio) || !isRatio(db.guardRatio)) return null;
  const health = {
    serverTime: body.serverTime,
    db: { bytes: db.bytes, limitBytes: db.limitBytes, warnRatio: db.warnRatio, guardRatio: db.guardRatio },
    ingestPaused: body.ingestPaused,
  };
  // Optional: a Worker deployed before the retention report has no block.
  const retention = parseRetention(body.retention);
  return retention ? { ...health, retention } : health;
}

const RETAINED = ['events', 'errors', 'reports'];
const isDays = (v) => Number.isInteger(v) && v >= 0;

/** The health `retention` block when well-formed, else undefined (ages may be null for empty tables). */
export function parseRetention(r) {
  if (!r || typeof r.enabled !== 'boolean' || !r.days || !r.oldestDays) return undefined;
  if (!RETAINED.every((t) => isDays(r.days[t]) && (r.oldestDays[t] === null || isDays(r.oldestDays[t])))) return undefined;
  const pick = (o) => Object.fromEntries(RETAINED.map((t) => [t, o[t]]));
  return { enabled: r.enabled, days: pick(r.days), oldestDays: pick(r.oldestDays) };
}

/** GET <base>/v1/health. A 404 is state 'missing' (endpoint not deployed yet), a network failure 'unreachable'. */
export async function fetchHealth(base, { fetch: fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const url = `${base.replace(/\/+$/, '')}/v1/health`;
  let res;
  try {
    res = await fetchImpl(url, { headers: { accept: 'application/json', 'user-agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    return { ok: false, state: 'unreachable', problem: `health check failed: GET ${url}: ${errorText(e, timeoutMs)}` };
  }
  if (res.status === 404) return { ok: false, state: 'missing', problem: `health endpoint not deployed yet (GET ${url} answered 404)` };
  if (!res.ok) return { ok: false, state: 'error', problem: `health check failed: GET ${url} answered HTTP ${res.status}` };
  let body;
  try {
    body = await res.json();
  } catch (e) {
    return { ok: false, state: 'error', problem: `health check failed: GET ${url} did not return JSON (${errorText(e, timeoutMs)})` };
  }
  const health = parseHealth(body);
  if (!health) return { ok: false, state: 'error', problem: `health check failed: GET ${url} returned a body that is not a HealthResponse` };
  return { ok: true, health };
}

/**
 * Whether and how to query Cloudflare: { query: { token, accountId,
 * databaseId, scriptName } }, or { skip: note } / { problem } when not.
 * `readTarget` returns { databaseId, scriptName } from the wrangler config
 * (it may throw); it is called only when both variables are set.
 */
export function cloudflareSetup(env, readTarget) {
  const token = (env.CLOUDFLARE_API_TOKEN ?? '').trim();
  const accountId = (env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  // Why: Workers Builds may export its deploy token, which has no Account
  // Analytics permission; the build-time check stays health-only there.
  if (env.WORKERS_CI === '1') return { skip: 'Cloudflare usage: skipped under Workers Builds (health only)' };
  if (!token && !accountId) {
    return { skip: "Cloudflare usage: skipped (set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID for today's D1 rows and Worker requests)" };
  }
  if (!token || !accountId) {
    return { skip: `Cloudflare usage: skipped (${token ? 'CLOUDFLARE_ACCOUNT_ID' : 'CLOUDFLARE_API_TOKEN'} is not set; both are needed)` };
  }
  if (!/^[0-9a-f]{32}$/i.test(accountId)) return { problem: 'Cloudflare usage: CLOUDFLARE_ACCOUNT_ID is not a 32-character hex account id' };
  let target;
  try {
    target = readTarget();
  } catch (e) {
    return { problem: `Cloudflare usage: ${e.message}` };
  }
  return { query: { token, accountId, databaseId: target.databaseId, scriptName: target.scriptName } };
}

const AUTH = /not authori[sz]ed|authenticat|authz|permission|forbidden|unauthori[sz]ed/i;

/** Error messages from a Cloudflare JSON body (GraphQL or REST), first two, capped. */
function messagesOf(json) {
  const list = Array.isArray(json?.errors) ? json.errors : [];
  const text = list
    .slice(0, 2)
    .map((e) => (typeof e?.message === 'string' ? e.message : JSON.stringify(e)))
    .join('; ');
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

/** Explains a failed response; `permission` names what the token needs. */
function describe(resp, permission, fallback) {
  const msg = messagesOf(resp.json);
  const parts = [resp.status !== 200 ? `HTTP ${resp.status}` : '', msg || fallback].filter(Boolean);
  const hint = resp.status === 401 || resp.status === 403 || AUTH.test(msg) ? ` (the token needs ${permission})` : '';
  return `${parts.join(': ')}${hint}`;
}

/**
 * Sums `fields` of `dataset` over the groups of a GraphQL response
 * ({ status, json } or { error }). No groups means nothing happened today: zeros.
 */
export function sumGraphql(resp, dataset, fields) {
  if (resp.error) return { ok: false, problem: resp.error };
  const errors = Array.isArray(resp.json?.errors) ? resp.json.errors : [];
  if (errors.length || resp.status !== 200) return { ok: false, problem: describe(resp, 'Account Analytics: Read', 'no data') };
  const accounts = resp.json?.data?.viewer?.accounts;
  if (!Array.isArray(accounts)) return { ok: false, problem: 'unexpected response (no data.viewer.accounts)' };
  if (!accounts.length) return { ok: false, problem: 'the token cannot see this account (check CLOUDFLARE_ACCOUNT_ID)' };
  const groups = accounts[0]?.[dataset];
  if (!Array.isArray(groups)) return { ok: false, problem: `unexpected response (no ${dataset})` };
  const values = Object.fromEntries(fields.map((f) => [f, 0]));
  for (const g of groups) {
    for (const f of fields) {
      const v = Number(g?.sum?.[f]);
      if (Number.isFinite(v)) values[f] += v;
    }
  }
  return { ok: true, values };
}

/** The database size from a D1 REST "get database" response ({ status, json } or { error }). */
export function parseD1Size(resp) {
  if (resp.error) return { ok: false, problem: resp.error };
  const size = resp.json?.result?.file_size;
  if (resp.status === 200 && resp.json?.success === true && typeof size === 'number' && size >= 0) return { ok: true, bytes: size };
  return { ok: false, problem: describe(resp, 'D1: Read', 'no file_size in the response') };
}

/** One request; resolves to { status, json } (json null when the body is not JSON) or { error }. */
async function request(fetchImpl, url, init, timeoutMs) {
  try {
    const res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    let json = null;
    try {
      json = await res.json();
    } catch {
      // A non-JSON body (an HTML error page): the status says enough.
    }
    return { status: res.status, json };
  } catch (e) {
    return { error: `request failed: ${errorText(e, timeoutMs)}` };
  }
}

/**
 * Today's (UTC, from `now`) D1 rows read/written, Worker requests and D1 size,
 * three requests in parallel. Each part is { ok, ... } on its own, so one
 * missing permission does not hide the others.
 */
export async function fetchCloudflareUsage({ token, accountId, databaseId, scriptName }, { fetch: fetchImpl = globalThis.fetch, now = Date.now(), timeoutMs = TIMEOUT_MS } = {}) {
  const day = new Date(now).toISOString().slice(0, 10);
  const headers = { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': UA };
  const graphql = (query, variables) =>
    request(fetchImpl, `${CF_API}/graphql`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) }, timeoutMs);
  const [d1, worker, size] = await Promise.all([
    graphql(D1_QUERY, { accountTag: accountId, start: day, end: day, databaseId }),
    graphql(WORKER_QUERY, { accountTag: accountId, datetimeStart: `${day}T00:00:00Z`, datetimeEnd: new Date(now).toISOString(), scriptName }),
    request(fetchImpl, `${CF_API}/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}`, { headers }, timeoutMs),
  ]);
  return {
    day,
    d1: sumGraphql(d1, 'd1AnalyticsAdaptiveGroups', ['rowsRead', 'rowsWritten']),
    worker: sumGraphql(worker, 'workersInvocationsAdaptive', ['requests']),
    size: parseD1Size(size),
  };
}
