// Coarse request classification for analytics points. Only a class and the
// Android major version are kept; the User-Agent string itself is never stored.

import type { UaClass } from './schema/rows.ts';

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|curl|wget|python|httpclient|monitor/i;
const IOS = /iphone|ipad|ipod/i;
const DESKTOP = /windows|macintosh|x11|linux|cros/i;

/** Bot first (crawlers often claim a platform), then Android before the generic Linux match. */
export function uaClass(userAgent: string | null): UaClass {
  if (!userAgent) return 'other';
  if (BOT.test(userAgent)) return 'bot';
  if (/android/i.test(userAgent)) return 'android';
  if (IOS.test(userAgent)) return 'ios';
  if (DESKTOP.test(userAgent)) return 'desktop';
  return 'other';
}

/** Android major version from `Android <n>` in the User-Agent, or null. */
export function androidMajor(userAgent: string | null): number | null {
  const m = userAgent ? /Android (\d+)/.exec(userAgent) : null;
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 999 ? n : null;
}
