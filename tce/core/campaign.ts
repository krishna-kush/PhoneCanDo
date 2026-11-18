// Campaign links: `https://phonecando.app/?c=<tag>`, counted per tag and day
// with no identity (campaign_daily). Ops pass on any well-formed tag; the
// store counts it only when the tag is in the database's campaigns table
// (migration 0005, filled by `./manage campaign add`), so any other `?c=` is
// ignored and nobody can fill the table with made-up tags.

/** Lowercase letters, digits and dashes, 1 to 24 characters. */
export const CAMPAIGN_TAG = /^[a-z0-9-]{1,24}$/;

/** True when `v` has the shape of a campaign tag. */
export function isCampaignTag(v: unknown): v is string {
  return typeof v === 'string' && CAMPAIGN_TAG.test(v);
}

/** The tag when `raw` has the shape of one, else null (ignored). */
export function campaignTagOf(raw: unknown): string | null {
  return isCampaignTag(raw) ? raw : null;
}
