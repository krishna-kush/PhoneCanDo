import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { campaignTagOf, isCampaignTag } from './campaign.ts';

describe('campaign tags', () => {
  it('are 1 to 24 lowercase letters, digits and dashes', () => {
    for (const ok of ['hn', 'reddit-androiddev', 'x', 'a'.repeat(24), '2026-launch']) assert.ok(isCampaignTag(ok), ok);
    for (const bad of ['', 'HN', 'a'.repeat(25), 'hn launch', 'hn_1', 'ü', null, 7]) assert.ok(!isCampaignTag(bad), String(bad));
  });

  it('pass on any well-formed tag (the store checks the list), anything else is null', () => {
    assert.equal(campaignTagOf('hn'), 'hn');
    assert.equal(campaignTagOf('never-made'), 'never-made');
    assert.equal(campaignTagOf('HN'), null);
    assert.equal(campaignTagOf('hn '), null);
    assert.equal(campaignTagOf(undefined), null);
    assert.equal(campaignTagOf(['hn']), null);
  });
});
