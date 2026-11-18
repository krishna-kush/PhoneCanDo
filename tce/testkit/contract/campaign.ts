// Contract cases for campaigns: the per-day open and download counts of a
// campaign tag, counted only when the tag is in the campaigns table (seeded
// through MakeOptions.campaigns: no Store method writes it), the checks on a
// row, and that forget never touches either table (a campaign has no owner).
// Rows are seen through the dump hook only: no op reads them back.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEVICE_ID, DEVICE_VERIFIER, batchWrite, campaignDailyRow, campaignRow } from '../fixtures.ts';
import type { Make } from './harness.ts';
import { apply, expectEmpty, expectRows, failure, using, value } from './harness.ts';

/** The two tags the cases list: CAMPAIGN_TAG and 'reddit'. */
const LISTED = [campaignRow(), campaignRow({ tag: 'reddit', note: 'r/androiddev thread' })];

/** Register the `campaigns` cases. */
export function campaignCases(make: Make): void {
  const listed = () => make({ campaigns: LISTED });

  describe('campaigns', () => {
    it(
      'countCampaignStep adds per tag, step and day for a listed tag',
      using(listed, async (s) => {
        for (let i = 0; i < 3; i++) value(await s.store.countCampaignStep(campaignDailyRow()), 'countCampaignStep');
        value(await s.store.countCampaignStep(campaignDailyRow({ step: 'download' })), 'countCampaignStep');
        value(await s.store.countCampaignStep(campaignDailyRow({ day: '2026-11-02', count: 2 })), 'countCampaignStep');
        value(await s.store.countCampaignStep(campaignDailyRow({ tag: 'reddit' })), 'countCampaignStep');
        await expectRows(s, 'campaign_daily', [
          campaignDailyRow({ count: 3 }),
          campaignDailyRow({ step: 'download' }),
          campaignDailyRow({ day: '2026-11-02', count: 2 }),
          campaignDailyRow({ tag: 'reddit' }),
        ]);
        await expectRows(s, 'campaigns', LISTED);
        await expectEmpty(s, ['campaign_daily', 'campaigns']);
      }),
    );

    it(
      'countCampaignStep answers ok and adds nothing for a tag not in campaigns',
      using(listed, async (s) => {
        value(await s.store.countCampaignStep(campaignDailyRow({ tag: 'never-made' })), 'countCampaignStep');
        value(await s.store.countCampaignStep(campaignDailyRow({ tag: 'never-made', step: 'download' })), 'countCampaignStep');
        value(await s.store.countCampaignStep(campaignDailyRow({ tag: 'hn-2' })), 'countCampaignStep');
        value(await s.store.countCampaignStep(campaignDailyRow()), 'countCampaignStep');
        await expectRows(s, 'campaign_daily', [campaignDailyRow()]);
        await expectRows(s, 'campaigns', LISTED);
      }),
    );

    it(
      'countCampaignStep counts nothing while the campaigns table is empty',
      using(make, async (s) => {
        value(await s.store.countCampaignStep(campaignDailyRow()), 'countCampaignStep');
        await expectEmpty(s);
      }),
    );

    it(
      'countCampaignStep refuses a malformed day and an unknown step',
      using(listed, async (s) => {
        assert.equal(failure(await s.store.countCampaignStep(campaignDailyRow({ day: '2026-11' })), 'countCampaignStep').code, 'bad_request');
        const step = 'install' as unknown as 'open';
        assert.equal(failure(await s.store.countCampaignStep(campaignDailyRow({ step })), 'countCampaignStep').code, 'bad_request');
        await expectEmpty(s, ['campaigns']);
      }),
    );

    it(
      'forget leaves campaign counts and the campaigns list alone',
      using(listed, async (s) => {
        await apply(s.store, batchWrite());
        value(await s.store.countCampaignStep(campaignDailyRow()), 'countCampaignStep');
        value(await s.store.forget(DEVICE_ID, DEVICE_VERIFIER), 'forget');
        await expectRows(s, 'campaign_daily', [campaignDailyRow()]);
        await expectRows(s, 'campaigns', LISTED);
      }),
    );
  });
}
