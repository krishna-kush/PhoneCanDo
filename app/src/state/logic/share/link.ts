// Where a share link points and how the app reads one back: a tracked link
// is phonecando.app/i/<code> (the site counts its opens and downloads), an
// untracked one is the site itself. When the app is opened through a link
// (Android hands it phonecando.app/i/* links once installed), it counts as
// an install from that link only for a fresh install, a friend's link (not
// one of ours) and only once. Pure (zero RN imports).
import { isShareCode } from './code.ts';

export const SITE = 'https://phonecando.app';

/** How long after the first install opening through a link still counts as installed from it. */
export const INSTALL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** The link a share sends: tracked with a code, else the site. */
export function shareLinkFor(code: string | null): string {
  return code ? `${SITE}/i/${code}` : SITE;
}

const LINK_RE = /^https:\/\/phonecando\.app\/i\/([^/?#]+)\/?(?:[?#].*)?$/i;

/** The code in a phonecando.app/i/<code> link; null for any other URL. */
export function codeFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = LINK_RE.exec(url.trim());
  const code = m?.[1];
  return isShareCode(code) ? code : null;
}

export type InstallCheck = {
  code: string;
  /** Codes this phone shared itself. */
  own: readonly string[];
  /** When the app was first installed (ms); null when the build can't tell. */
  firstInstallAt: number | null;
  now: number;
  /** An install from a link was already counted on this phone. */
  counted: boolean;
};

/** Whether opening the app through `code` counts as an install from that link. */
export function countsAsInstall(c: InstallCheck): boolean {
  if (c.counted || !isShareCode(c.code) || c.own.includes(c.code)) return false;
  if (c.firstInstallAt == null || !Number.isFinite(c.firstInstallAt)) return false;
  const age = c.now - c.firstInstallAt;
  return age >= 0 && age <= INSTALL_WINDOW_MS;
}
