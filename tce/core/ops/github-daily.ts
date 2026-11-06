// Cron github_daily: pull GitHub's own counters (release asset downloads,
// stars, forks, watchers; repo traffic when a token is configured) into the
// store, one row set per UTC day. Nothing is written to GitHub.

import type { CronOp, FetchPort, OpCtx } from '../op.ts';
import { err, ok, type TceResult } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import type { GithubAssetDailyRow, GithubRepoDailyRow } from '../schema/rows.ts';
import { utcDay } from '../time.ts';
import { isPlainObject, truncate } from '../validate.ts';

const API = 'https://api.github.com';
const PER_PAGE = 100;
/** Releases pages fetched at most (300 releases); keeps one run to a handful of subrequests. */
export const MAX_RELEASE_PAGES = 3;

type Traffic = Pick<GithubRepoDailyRow, 'views' | 'view_uniques' | 'clones' | 'clone_uniques' | 'referrers'>;

/** Request headers GitHub's REST API expects; the token is optional. */
export function githubHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'phonecando-tce',
    'x-github-api-version': '2022-11-28',
  };
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function count(v: unknown): number | null {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null;
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** GET a JSON document; any network, status or JSON failure is `unavailable`. */
async function getJson(fetch: FetchPort, url: string, headers: Record<string, string>): Promise<TceResult<unknown>> {
  const where = url.slice(API.length);
  let res: Awaited<ReturnType<FetchPort>>;
  try {
    res = await fetch(url, { method: 'GET', headers });
  } catch (e) {
    return err('unavailable', `GitHub request ${where} failed: ${errorText(e)}`);
  }
  if (!res.ok) return err('unavailable', `GitHub answered ${res.status} for ${where}`);
  try {
    return ok(await res.json());
  } catch {
    return err('unavailable', `GitHub sent invalid JSON for ${where}`);
  }
}

/** Asset rows of one releases page (drafts skipped) and the page's raw length. */
export function readReleasesPage(
  v: unknown,
  day: string,
): TceResult<{ assets: GithubAssetDailyRow[]; releases: number; length: number }> {
  const bad = err('unavailable', 'unexpected GitHub releases response');
  if (!Array.isArray(v)) return bad;
  const assets: GithubAssetDailyRow[] = [];
  let releases = 0;
  for (const rel of v) {
    if (!isPlainObject(rel)) return bad;
    if (rel.draft === true) continue;
    if (typeof rel.tag_name !== 'string' || !Array.isArray(rel.assets)) return bad;
    releases++;
    for (const a of rel.assets) {
      const downloads = isPlainObject(a) ? count(a.download_count) : null;
      if (!isPlainObject(a) || typeof a.name !== 'string' || downloads === null) return bad;
      assets.push({ day, tag: rel.tag_name, asset: a.name, download_count: downloads });
    }
  }
  return ok({ assets, releases, length: v.length });
}

async function readCountPair(
  fetch: FetchPort,
  url: string,
  headers: Record<string, string>,
): Promise<{ count: number; uniques: number } | null> {
  const res = await getJson(fetch, url, headers);
  if (!res.ok || !isPlainObject(res.value)) return null;
  const c = count(res.value.count);
  const u = count(res.value.uniques);
  return c === null || u === null ? null : { count: c, uniques: u };
}

async function readReferrers(fetch: FetchPort, url: string, headers: Record<string, string>): Promise<string | null> {
  const res = await getJson(fetch, url, headers);
  if (!res.ok || !Array.isArray(res.value)) return null;
  const out: { referrer: string; count: number; uniques: number }[] = [];
  for (const r of res.value) {
    if (!isPlainObject(r) || typeof r.referrer !== 'string') return null;
    const c = count(r.count);
    const u = count(r.uniques);
    if (c === null || u === null) return null;
    out.push({ referrer: truncate(r.referrer, LIMITS.hostLength), count: c, uniques: u });
  }
  return JSON.stringify(out);
}

/** Repo traffic (needs a token with Administration: read). Each part that fails is null, never an error. */
async function readTraffic(fetch: FetchPort, base: string, headers: Record<string, string>): Promise<Traffic> {
  const [views, clones, referrers] = await Promise.all([
    readCountPair(fetch, `${base}/traffic/views`, headers),
    readCountPair(fetch, `${base}/traffic/clones`, headers),
    readReferrers(fetch, `${base}/traffic/popular/referrers`, headers),
  ]);
  return {
    views: views?.count ?? null,
    view_uniques: views?.uniques ?? null,
    clones: clones?.count ?? null,
    clone_uniques: clones?.uniques ?? null,
    referrers,
  };
}

const NO_TRAFFIC: Traffic = { views: null, view_uniques: null, clones: null, clone_uniques: null, referrers: null };

/** Cron github_daily, 03:17 UTC. */
export const githubDailyOp: CronOp = {
  kind: 'cron',
  name: 'github_daily',
  schedule: '17 3 * * *',

  async run(ctx: OpCtx): Promise<TceResult<Record<string, number | string>>> {
    const { repo } = ctx.config.release;
    const token = ctx.config.githubToken;
    const day = utcDay(ctx.clock.now());
    const headers = githubHeaders(token);
    const base = `${API}/repos/${repo}`;

    // Keyed by (tag, asset) so a release listed on two pages (it moved while paging) counts once.
    const assets = new Map<string, GithubAssetDailyRow>();
    let releases = 0;
    for (let page = 1; page <= MAX_RELEASE_PAGES; page++) {
      const url = `${base}/releases?per_page=${PER_PAGE}${page === 1 ? '' : `&page=${page}`}`;
      const res = await getJson(ctx.fetch, url, headers);
      if (!res.ok) return res;
      const parsed = readReleasesPage(res.value, day);
      if (!parsed.ok) return parsed;
      releases += parsed.value.releases;
      for (const a of parsed.value.assets) assets.set(`${a.tag}\u0000${a.asset}`, a);
      if (parsed.value.length < PER_PAGE) break;
    }

    const [repoRes, traffic] = await Promise.all([
      getJson(ctx.fetch, base, headers),
      token ? readTraffic(ctx.fetch, base, headers) : Promise.resolve(NO_TRAFFIC),
    ]);
    if (!repoRes.ok) return repoRes;
    const r = repoRes.value;
    const stars = isPlainObject(r) ? count(r.stargazers_count) : null;
    const forks = isPlainObject(r) ? count(r.forks_count) : null;
    // GitHub's `watchers_count` mirrors stars; real watchers are `subscribers_count`.
    const watchers = isPlainObject(r) ? count(r.subscribers_count) : null;
    if (stars === null || forks === null || watchers === null) return err('unavailable', 'unexpected GitHub repo response');

    const rows = [...assets.values()];
    const stored = await ctx.store.upsertGithubDaily(rows, { day, stars, forks, watchers, ...traffic });
    if (!stored.ok) return stored;

    const parts = [traffic.views, traffic.clones, traffic.referrers].filter((x) => x !== null).length;
    return ok({
      day,
      releases,
      assets: rows.length,
      downloads: rows.reduce((sum, a) => sum + a.download_count, 0),
      stars,
      traffic: !token ? 'no_token' : parts === 3 ? 'ok' : parts === 0 ? 'failed' : 'partial',
    });
  },
};
