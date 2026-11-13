// Share links: the code a phone puts in each link it shares
// (https://phonecando.app/i/<code>) and the rows a batch's share events add.
// A code is made on the phone; the first device whose batch carries
// `share.sent` with it owns it. Opens and downloads are counted per code and
// day with no identity; an install is the phone that sent `share.install`
// (only from phones with usage stats on), one per phone, never the link's own.

import type { ShareInstallRow, ShareLinkRow } from './schema/rows.ts';
import { utcDay } from './time.ts';

/** 8 characters without look-alikes (no l, o, 0, 1). */
export const SHARE_CODE = /^[a-km-np-z2-9]{8}$/;

/** True when `v` is a share code. */
export function isShareCode(v: unknown): v is string {
  return typeof v === 'string' && SHARE_CODE.test(v);
}

/** One accepted event as the share rules read it: name, raw props, corrected time. */
export interface ShareEvent {
  name: string;
  props: Readonly<Record<string, unknown>> | null;
  /** Skew-corrected client time (ms). */
  ts: number;
}

/** The share rows one batch adds. */
export interface ShareRows {
  shareLinks: ShareLinkRow[];
  shareInstalls: ShareInstallRow[];
}

/**
 * share_links rows from `share.sent` and at most one share_installs row from
 * the first `share.install`, for the batch's device. Events without a valid
 * `code` prop add nothing; a code sent twice in one batch is one row.
 */
export function shareRowsOf(events: readonly ShareEvent[], deviceId: string): ShareRows {
  const shareLinks: ShareLinkRow[] = [];
  const seen = new Set<string>();
  let install: ShareInstallRow | null = null;
  for (const e of events) {
    const code = e.props?.['code'];
    if (!isShareCode(code)) continue;
    if (e.name === 'share.sent' && !seen.has(code)) {
      seen.add(code);
      shareLinks.push({ code, device_id: deviceId, created: e.ts });
    } else if (e.name === 'share.install' && install === null) {
      install = { device_id: deviceId, code, ts: e.ts, day: utcDay(e.ts) };
    }
  }
  return { shareLinks, shareInstalls: install ? [install] : [] };
}
