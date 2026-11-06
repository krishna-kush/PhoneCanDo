// GET /dl/:channel: count an APK download, then redirect to the GitHub release
// asset of the current version. The redirect never waits on a failed count,
// and a caller over the host's rate limit is redirected without being counted.

import type { HttpOp, HttpResponse, RequestCtx } from '../op.ts';
import { writePointSafely } from '../points.ts';
import { refHost } from '../referrer.ts';
import { err, ok, type TceResult } from '../result.ts';
import type { DownloadPoint } from '../schema/rows.ts';
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
}

/** GitHub release asset URL of the arm64 APK for `channel` at `version`. */
export function apkUrl(repo: string, version: string, channel: DownloadChannel): string {
  return `https://github.com/${repo}/releases/download/v${version}/phonecando-${version}-${channel}-arm64.apk`;
}

/** GET /dl/:channel. */
export const downloadOp: HttpOp<DownloadInput> = {
  kind: 'http',
  name: 'download',
  method: 'GET',
  path: '/dl/:channel',
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
    });
  },

  async run(input, ctx: RequestCtx): Promise<TceResult<HttpResponse>> {
    const { repo, version } = ctx.config.release;
    if (input.countable) {
      const point: DownloadPoint = {
        day: utcDay(ctx.clock.now()),
        channel: input.channel,
        version,
        country: ctx.edge.country,
        androidMajor: androidMajor(input.userAgent),
        refHost: refHost(input.referer, input.host),
        uaClass: uaClass(input.userAgent),
      };
      await writePointSafely(ctx.log, 'download', () => ctx.store.writeDownloadPoint(point));
    }
    // no-store: the target moves with every release, so a cached redirect would serve an old APK.
    return ok({ status: 302, location: apkUrl(repo, version, input.channel), headers: { 'Cache-Control': 'no-store' } });
  },
};
