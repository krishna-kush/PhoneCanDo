import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createMemoryStore, type MemoryStore } from '../../stores/memory/index.ts';
import { fakeCtx, type FakeCtx } from '../../testkit/ctx.ts';
import { err } from '../result.ts';
import { githubDailyOp, githubHeaders, readReleasesPage } from './github-daily.ts';

const REPO = 'https://api.github.com/repos/krishna-kush/PhoneCanDo';
const RELEASES = `${REPO}/releases?per_page=100`;
// 2026-11-05T23:59:59Z: the day is taken in UTC.
const NOW = Date.UTC(2026, 10, 5, 23, 59, 59);

function release(tag: string, assets: [string, number][], draft = false) {
  return { tag_name: tag, draft, prerelease: false, assets: assets.map(([name, download_count]) => ({ name, download_count, size: 1 })) };
}

const REPO_JSON = { stargazers_count: 12, forks_count: 2, subscribers_count: 3, watchers_count: 12 };

function setup(token: string | null = null, store: MemoryStore = createMemoryStore()): FakeCtx<MemoryStore> {
  return fakeCtx({ store, now: NOW, config: { githubToken: token } });
}

function publicRoutes(ctx: FakeCtx<MemoryStore>): void {
  ctx.fetch.route(RELEASES, 200, [
    release('v0.1.2', [
      ['phonecando-0.1.2-lite-arm64.apk', 3],
      ['phonecando-0.1.2-full-arm64.apk', 3],
      ['latest.json', 31],
    ]),
    release('v0.2.0', [['phonecando-0.2.0-lite-arm64.apk', 0]], true),
    release('v0.1.1', [['phonecando-0.1.1-lite-arm64.apk', 13]]),
  ]);
  ctx.fetch.route(REPO, 200, REPO_JSON);
}

describe('github_daily', () => {
  it('is the 03:17 UTC daily cron', () => {
    assert.deepEqual([githubDailyOp.kind, githubDailyOp.name, githubDailyOp.schedule], ['cron', 'github_daily', '17 3 * * *']);
  });

  it('stores asset counts (drafts skipped) and repo counters without traffic when there is no token', async () => {
    const ctx = setup();
    publicRoutes(ctx);
    const r = await githubDailyOp.run(ctx);
    assert.deepEqual(r, {
      ok: true,
      value: { day: '2026-11-05', releases: 2, assets: 4, downloads: 50, stars: 12, traffic: 'no_token' },
    });
    assert.deepEqual(ctx.store.tables.github_assets_daily, [
      { day: '2026-11-05', tag: 'v0.1.2', asset: 'phonecando-0.1.2-lite-arm64.apk', download_count: 3 },
      { day: '2026-11-05', tag: 'v0.1.2', asset: 'phonecando-0.1.2-full-arm64.apk', download_count: 3 },
      { day: '2026-11-05', tag: 'v0.1.2', asset: 'latest.json', download_count: 31 },
      { day: '2026-11-05', tag: 'v0.1.1', asset: 'phonecando-0.1.1-lite-arm64.apk', download_count: 13 },
    ]);
    assert.deepEqual(ctx.store.tables.github_repo_daily, [
      {
        day: '2026-11-05',
        stars: 12,
        forks: 2,
        watchers: 3,
        views: null,
        view_uniques: null,
        clones: null,
        clone_uniques: null,
        referrers: null,
      },
    ]);
    assert.deepEqual(
      ctx.fetch.calls.map((c) => c.url),
      [RELEASES, REPO],
      'no traffic calls without a token',
    );
    for (const c of ctx.fetch.calls) {
      assert.deepEqual(c.init, { method: 'GET', headers: githubHeaders(null) });
      assert.equal('authorization' in c.init!.headers!, false);
    }
    assert.deepEqual(githubHeaders(null), {
      accept: 'application/vnd.github+json',
      'user-agent': 'phonecando-tce',
      'x-github-api-version': '2022-11-28',
    });
  });

  it('follows release pages until a short page', async () => {
    const ctx = setup();
    const page = (n: number, count: number) =>
      Array.from({ length: count }, (_, i) => release(`v${n}.${i}`, [[`a-${n}-${i}.apk`, 1]]));
    ctx.fetch.route(RELEASES, 200, page(1, 100));
    ctx.fetch.route(`${RELEASES}&page=2`, 200, page(2, 5));
    ctx.fetch.route(REPO, 200, REPO_JSON);
    const r = await githubDailyOp.run(ctx);
    assert.equal(r.ok && r.value.releases, 105);
    assert.equal(ctx.store.tables.github_assets_daily.length, 105);
    assert.deepEqual(
      ctx.fetch.calls.map((c) => c.url),
      [RELEASES, `${RELEASES}&page=2`, REPO],
    );
  });

  it('stops after three full pages', async () => {
    const ctx = setup();
    const page = (n: number) => Array.from({ length: 100 }, (_, i) => release(`v${n}.${i}`, [[`a.apk`, n]]));
    ctx.fetch.route(RELEASES, 200, page(1));
    ctx.fetch.route(`${RELEASES}&page=2`, 200, page(2));
    ctx.fetch.route(`${RELEASES}&page=3`, 200, page(3));
    ctx.fetch.route(`${RELEASES}&page=4`, 500, { message: 'must not be called' });
    ctx.fetch.route(REPO, 200, REPO_JSON);
    const r = await githubDailyOp.run(ctx);
    assert.equal(r.ok && r.value.releases, 300);
    assert.equal(ctx.fetch.calls.filter((c) => c.url.includes('page=4')).length, 0);
  });

  it('sends the token and stores traffic when a token is configured', async () => {
    const ctx = setup('github_pat_test');
    publicRoutes(ctx);
    ctx.fetch.route(`${REPO}/traffic/views`, 200, { count: 39, uniques: 4, views: [] });
    ctx.fetch.route(`${REPO}/traffic/clones`, 200, { count: 7, uniques: 2, clones: [] });
    ctx.fetch.route(`${REPO}/traffic/popular/referrers`, 200, [
      { referrer: 'news.ycombinator.com', count: 20, uniques: 3 },
      { referrer: 'github.com', count: 5, uniques: 1 },
    ]);
    const r = await githubDailyOp.run(ctx);
    assert.equal(r.ok && r.value.traffic, 'ok');
    assert.deepEqual(ctx.store.tables.github_repo_daily[0], {
      day: '2026-11-05',
      stars: 12,
      forks: 2,
      watchers: 3,
      views: 39,
      view_uniques: 4,
      clones: 7,
      clone_uniques: 2,
      referrers: JSON.stringify([
        { referrer: 'news.ycombinator.com', count: 20, uniques: 3 },
        { referrer: 'github.com', count: 5, uniques: 1 },
      ]),
    });
    assert.equal(ctx.fetch.calls.length, 5);
    for (const c of ctx.fetch.calls) assert.equal(c.init!.headers!.authorization, 'Bearer github_pat_test');
  });

  it('turns any traffic failure into nulls, not a failed run', async () => {
    const ctx = setup('github_pat_test');
    publicRoutes(ctx);
    ctx.fetch.route(`${REPO}/traffic/views`, 403, { message: 'Resource not accessible by personal access token' });
    ctx.fetch.route(`${REPO}/traffic/clones`, 200, { count: 7, uniques: 2 });
    ctx.fetch.fail(`${REPO}/traffic/popular/referrers`);
    const r = await githubDailyOp.run(ctx);
    assert.equal(r.ok && r.value.traffic, 'partial');
    const row = ctx.store.tables.github_repo_daily[0]!;
    assert.deepEqual(
      [row.views, row.view_uniques, row.clones, row.clone_uniques, row.referrers],
      [null, null, 7, 2, null],
    );
  });

  it('reports upstream failures as unavailable and stores nothing', async () => {
    const cases: [string, (ctx: FakeCtx<MemoryStore>) => void][] = [
      ['releases 500', (ctx) => ctx.fetch.route(RELEASES, 500, { message: 'oops' })],
      ['releases network', (ctx) => ctx.fetch.fail(RELEASES)],
      ['releases bad JSON', (ctx) => ctx.fetch.routeText(RELEASES, 200, '<html>rate limited</html>')],
      ['releases wrong shape', (ctx) => ctx.fetch.route(RELEASES, 200, { message: 'not a list' })],
      ['asset wrong shape', (ctx) => ctx.fetch.route(RELEASES, 200, [{ tag_name: 'v1', draft: false, assets: [{ name: 'a' }] }])],
      [
        'repo 404',
        (ctx) => {
          ctx.fetch.route(RELEASES, 200, []);
          ctx.fetch.route(REPO, 404, { message: 'Not Found' });
        },
      ],
      [
        'repo wrong shape',
        (ctx) => {
          ctx.fetch.route(RELEASES, 200, []);
          ctx.fetch.route(REPO, 200, { stargazers_count: 'many' });
        },
      ],
    ];
    for (const [label, arrange] of cases) {
      const ctx = setup();
      arrange(ctx);
      const r = await githubDailyOp.run(ctx);
      assert.equal(!r.ok && r.error.code, 'unavailable', label);
      assert.deepEqual(ctx.store.tables.github_assets_daily, [], label);
      assert.deepEqual(ctx.store.tables.github_repo_daily, [], label);
    }
  });

  it('passes a store failure through', async () => {
    const store = createMemoryStore();
    const ctx = setup(null, { ...store, upsertGithubDaily: async () => err('unavailable', 'db down') });
    publicRoutes(ctx);
    assert.deepEqual(await githubDailyOp.run(ctx), { ok: false, error: { code: 'unavailable', message: 'db down' } });
  });

  it('parses a releases page', () => {
    const r = readReleasesPage([release('v1', [['x.apk', 2]]), release('v2', [], true)], '2026-01-01');
    assert.deepEqual(r, {
      ok: true,
      value: { assets: [{ day: '2026-01-01', tag: 'v1', asset: 'x.apk', download_count: 2 }], releases: 1, length: 2 },
    });
  });
});
