// POST /v1/share/stats: what share links did, by code (the app's Tell a
// friend page). No identity: a code is the link itself, so whoever holds a
// link can read its counts; codes are random enough that guessing one is
// hopeless under the rate limit.

import type { HttpOp, HttpResponse, RequestCtx } from '../op.ts';
import { err, ok, type TceResult } from '../result.ts';
import { LIMITS } from '../schema/limits.ts';
import type { ShareStatsResponse } from '../schema/wire.ts';
import { isShareCode } from '../share.ts';
import { Reader } from '../validate.ts';

/** Distinct share codes, in request order. */
export interface ShareStatsInput {
  codes: string[];
}

/** Validate `{ codes }`: 1..LIMITS.shareStatsCodes share codes; duplicates are asked once. */
export function parseShareStats(body: unknown): TceResult<ShareStatsInput> {
  const r = new Reader();
  const o = r.object(body, '');
  if (r.error) return r.done({ codes: [] });
  const list = o.codes;
  if (!Array.isArray(list) || list.length === 0) return err('bad_request', 'must be a non-empty array of share codes', 'codes');
  if (list.length > LIMITS.shareStatsCodes) return err('too_large', `at most ${LIMITS.shareStatsCodes} codes`, 'codes');
  if (!list.every(isShareCode)) return err('bad_request', 'every entry must be a share code', 'codes');
  return ok({ codes: [...new Set(list)] });
}

/** POST /v1/share/stats. */
export const shareStatsOp: HttpOp<ShareStatsInput> = {
  kind: 'http',
  name: 'share_stats',
  method: 'POST',
  path: '/v1/share/stats',
  maxBodyBytes: LIMITS.smallBodyBytes,

  parse(req) {
    return parseShareStats(req.body);
  },

  async run(input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    const stats = await ctx.store.shareStats(input.codes);
    if (!stats.ok) return stats;
    const json: ShareStatsResponse = { links: stats.value };
    return ok({ status: 200, json });
  },
};
