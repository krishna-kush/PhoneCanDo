// GET /i/:code on the site's host: a share link someone opened. Counts +1
// `open` for the code in share_daily, then sends the browser to the home page
// with the code (`/?i=<code>`), whose download buttons carry it on. No ID,
// no cookie, nothing kept about the person.
//
// Only a person's browser counts, with the download op's rule: a navigation
// (Sec-Fetch-Mode: navigate) from a client that does not name itself a bot.
// Chat apps' link previews (WhatsApp, Telegram) fetch without it, so they do
// not count. HEAD and a caller over the rate limit still redirect, uncounted.

import type { HttpOp, HttpResponse, RequestCtx } from '../op.ts';
import { writePointSafely } from '../points.ts';
import { ok, type TceResult } from '../result.ts';
import { isShareCode } from '../share.ts';
import { utcDay } from '../time.ts';
import { uaClass } from '../ua.ts';

/** What the redirect needs from the request. */
export interface ShareOpenInput {
  /** The link's code; null when the path does not hold one (the redirect goes home). */
  code: string | null;
  /** Count it: a person's browser, GET, within the rate limit. */
  countable: boolean;
}

/** GET /i/:code. */
export const shareOpenOp: HttpOp<ShareOpenInput> = {
  kind: 'http',
  name: 'share_open',
  method: 'GET',
  path: '/i/:code',
  maxBodyBytes: 0,
  // Why degrade: a person opening a link must always reach the site.
  whenLimited: 'degrade',

  parse(req) {
    const raw = (req.params.code ?? '').toLowerCase();
    const code = isShareCode(raw) ? raw : null;
    const person = req.headers.secFetchMode === 'navigate' && uaClass(req.headers.userAgent) !== 'bot';
    return ok({ code, countable: code !== null && person && req.method !== 'HEAD' && !req.limited });
  },

  async run(input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    if (input.countable && input.code !== null) {
      const row = { day: utcDay(ctx.clock.now()), code: input.code, step: 'open' as const, count: 1 };
      await writePointSafely(ctx.log, 'share open', () => ctx.store.countShareStep(row));
    }
    // Relative, so the page opens on the host the link was opened on.
    const location = input.code === null ? '/' : `/?i=${input.code}`;
    return ok({ status: 302, location, headers: { 'Cache-Control': 'no-store' } });
  },
};
