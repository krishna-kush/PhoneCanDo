import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LEAD_DAYS, hasCritical, renderRetention, retentionFindings } from './retention-watch.mjs';

const DAYS = { events: 90, errors: 180, reports: 90 };
const block = (enabled, oldestDays) => ({ enabled, days: DAYS, oldestDays });

describe('retentionFindings', () => {
  it('says nothing while retention is on, or when an older Worker sends no block', () => {
    assert.deepEqual(retentionFindings(block(true, { events: 400, errors: 400, reports: 400 })), []);
    assert.deepEqual(retentionFindings(undefined), []);
    assert.deepEqual(retentionFindings(null), []);
  });

  it('says nothing while retention is off and every table is younger than the lead window or empty', () => {
    assert.deepEqual(retentionFindings(block(false, { events: 90 - LEAD_DAYS - 1, errors: 10, reports: null })), []);
  });

  it('warns from LEAD_DAYS before the promised age, per table', () => {
    const f = retentionFindings(block(false, { events: 90 - LEAD_DAYS, errors: 166, reports: 3 }));
    assert.deepEqual(f.map((x) => x.level), ['warn', 'warn']);
    assert.match(f[0].text, /oldest events row is 76 days old \(14 left\)/);
    assert.match(f[1].text, /deletion of errors after 180 days/);
    assert.match(f[0].text, /RETENTION_ENABLED in tce\/hosts\/cloudflare\/wrangler\.jsonc before day 90/);
    assert.equal(hasCritical(f), false);
  });

  it('is CRITICAL once the oldest row has reached the promised age', () => {
    const f = retentionFindings(block(false, { events: 90, errors: 12, reports: 120 }));
    assert.deepEqual(f.map((x) => x.level), ['critical', 'critical']);
    assert.match(f[0].text, /^CRITICAL: retention is off and the oldest events row is 90 days old/);
    assert.match(f[1].text, /now inaccurate for reports/);
    assert.equal(hasCritical(f), true);
  });

  it('ignores malformed ages instead of guessing', () => {
    assert.deepEqual(retentionFindings(block(false, { events: '95', errors: 1.5, reports: -1 })), []);
  });
});

describe('renderRetention', () => {
  it('prints the switch and each table age against its promise', () => {
    assert.equal(
      renderRetention(block(false, { events: 12, errors: null, reports: 3 })),
      'Retention: OFF (keeping everything) · oldest kept: events 12 d of 90 d, errors none of 180 d, reports 3 d of 90 d',
    );
    assert.match(renderRetention(block(true, { events: null, errors: null, reports: null })), /^Retention: ON/);
    assert.match(renderRetention(undefined), /unknown/);
  });
});
