// Contract case for the GitHub counters: upsertGithubDaily keys asset rows by
// (day, tag, asset) and the repo row by day.

import { describe, it } from 'node:test';
import { githubAssetRow, githubRepoRow } from '../fixtures.ts';
import type { Make } from './harness.ts';
import { expectEmpty, expectRows, using, value } from './harness.ts';

/** Register the `upsertGithubDaily` case. */
export function githubCases(make: Make): void {
  describe('upsertGithubDaily', () => {
    it(
      'upserts asset rows by (day, tag, asset) and the repo row by day',
      using(make, async (s) => {
        const lite = githubAssetRow();
        const full = githubAssetRow({ asset: 'phonecando-0.1.2-full-arm64.apk' });
        value(await s.store.upsertGithubDaily([lite, full], githubRepoRow()), 'upsertGithubDaily');
        const liteLater = { ...lite, download_count: 5 };
        const nextDay = githubAssetRow({ day: '2026-11-02', download_count: 7 });
        const repo = githubRepoRow({
          stars: 13,
          views: 39,
          view_uniques: 4,
          clones: 2,
          clone_uniques: 1,
          referrers: '[{"referrer":"news.ycombinator.com","count":9,"uniques":3}]',
        });
        value(await s.store.upsertGithubDaily([liteLater, nextDay], repo), 'upsertGithubDaily');
        value(await s.store.upsertGithubDaily([], null), 'upsertGithubDaily empty');
        await expectRows(s, 'github_assets_daily', [liteLater, full, nextDay]);
        await expectRows(s, 'github_repo_daily', [repo]);
        await expectEmpty(s, ['github_assets_daily', 'github_repo_daily']);
      }),
    );
  });
}
