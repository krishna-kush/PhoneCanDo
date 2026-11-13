// GET /v1/dl/:channel: count an APK download, then redirect to the GitHub release
// asset of the current version. The redirect never waits on a failed count,
// and a caller over the host's rate limit is redirected without being counted.
//
// Only a person's browser counts in site_daily: a navigation (Sec-Fetch-Mode:
// navigate, which browsers send when someone clicks a link or opens a URL, a
// scanned QR code included) from a client that does not name itself a bot.
// Anything else (curl, scripts, crawlers faking a browser user agent, which
// send no Sec-Fetch headers) still gets the redirect and is kept in the
// analytics point as client 'bot', so bot volume stays visible.
//
// `?i=<code>`: the download came from a share link's page (`/?i=<code>`, see
// share-open.ts); a download that counts in site_daily also adds +1
// `download` for that code in share_daily. A bad code is ignored.

import type { HttpOp, HttpResponse, RequestCtx } from '../op.ts';
import { writePointSafely } from '../points.ts';
import { refHost } from '../referrer.ts';
import { err, ok, type TceResult } from '../result.ts';
import type { DownloadPoint } from '../schema/rows.ts';
import { isShareCode } from '../share.ts';
import { utcDay } from '../time.ts';
import { androidMajor, uaClass } from '../ua.ts';

/** Channels with a public APK. */
export type DownloadChannel = DownloadPoint['channel'];

/** What the redirect needs from the request. */
export interface DownloadInput {
  channel: DownloadChannel;
  userAgent: string | null;
  referer: string | null;
  host: string | null;
  /**
   * False for HEAD (e.g. `curl -I`, link checkers) and for a caller over the
   * host's rate limit: both redirect but are not counted as a download.
   */
  countable: boolean;
  /** Sec-Fetch-Mode was 'navigate': a browser followed a link or opened the URL. */
  navigation: boolean;
  /** The share link the download came from (`?i=`), or null. */
  shareCode: string | null;
}

/** GitHub release asset URL of the arm64 APK for `channel` at `version`. */
export function apkUrl(repo: string, version: string, channel: DownloadChannel): string {
  return `https://github.com/${repo}/releases/download/v${version}/phonecando-${version}-${channel}-arm64.apk`;
}

/** The `?i=` share code, or null when absent or not a code. */
function shareCodeOf(raw: string | undefined): string | null {
  return isShareCode(raw) ? raw : null;
}

/** GET /v1/dl/:channel. */
export const downloadOp: HttpOp<DownloadInput> = {
  kind: 'http',
  name: 'download',
  method: 'GET',
  path: '/v1/dl/:channel',
  maxBodyBytes: 0,
  // Why degrade: a user clicking Download must always get the APK.
  whenLimited: 'degrade',

  parse(req) {
    const channel = req.params.channel;
    if (channel !== 'lite' && channel !== 'full') return err('not_found', 'unknown download channel', 'channel');
    return ok({
      channel,
      userAgent: req.headers.userAgent,
      referer: req.headers.referer,
      host: req.headers.host,
      countable: req.method !== 'HEAD' && !req.limited,
      navigation: req.headers.secFetchMode === 'navigate',
      shareCode: shareCodeOf(req.query['i']),
    });
  },

  async run(input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    const { repo, version } = ctx.config.release;
    if (input.countable) {
      const client = uaClass(input.userAgent);
      const person = input.navigation && client !== 'bot';
      const point: DownloadPoint = {
        day: utcDay(ctx.clock.now()),
        channel: input.channel,
        version,
        country: ctx.edge.country,
        androidMajor: androidMajor(input.userAgent),
        refHost: refHost(input.referer, input.host),
        uaClass: person ? client : 'bot',
      };
      await writePointSafely(ctx.log, 'download', () => ctx.store.writeDownloadPoint(point, { rollup: person }));
      if (person && input.shareCode !== null) {
        const row = { day: point.day, code: input.shareCode, step: 'download' as const, count: 1 };
        await writePointSafely(ctx.log, 'share download', () => ctx.store.countShareStep(row));
      }
    }
    // no-store: the target moves with every release, so a cached redirect would serve an old APK.
    return ok({ status: 302, location: apkUrl(repo, version, input.channel), headers: { 'Cache-Control': 'no-store' } });
  },
};
