// The links this phone shared, kept in AsyncStorage newest first: each
// one's code (null when it went out untracked), when, and the app it went
// through (its label, shown only here). With an account, the tracked ones
// also live in the account's list, so a new phone gets them back (without
// the app, which never leaves the phone). Pure (zero RN imports).
import type { AccountShareLink } from '../../../engine/account/wire.ts';
import { isShareCode } from './code.ts';

export type ShareLink = { code: string | null; at: number; app: string | null };

/** What is kept: the links, and whether an install from a friend's link was counted here. */
export type ShareKept = { links: ShareLink[]; installCounted: boolean };

export const MAX_LINKS = 500;

export const EMPTY: ShareKept = { links: [], installCounted: false };

function newestFirst(links: ShareLink[]): ShareLink[] {
  return [...links].sort((a, b) => b.at - a.at).slice(0, MAX_LINKS);
}

function parseLink(v: unknown): ShareLink | null {
  if (v === null || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.at !== 'number' || !Number.isFinite(o.at)) return null;
  const code = isShareCode(o.code) ? o.code : null;
  if (o.code != null && code == null) return null;
  return { code, at: o.at, app: typeof o.app === 'string' && o.app ? o.app : null };
}

/** The kept JSON; anything unreadable starts empty. */
export function parseKept(raw: string | null): ShareKept {
  if (!raw) return EMPTY;
  try {
    const o = JSON.parse(raw) as { links?: unknown; installCounted?: unknown } | null;
    const links = Array.isArray(o?.links) ? o.links.map(parseLink).filter((l): l is ShareLink => l !== null) : [];
    return { links: newestFirst(links), installCounted: o?.installCounted === true };
  } catch {
    return EMPTY;
  }
}

/** The list with `link` added (a code already there is not added twice). */
export function addLink(links: ShareLink[], link: ShareLink): ShareLink[] {
  if (link.code && links.some((l) => l.code === link.code)) return links;
  return newestFirst([link, ...links]);
}

/** The tracked codes, newest first. */
export function trackedCodes(links: readonly ShareLink[]): string[] {
  return links.flatMap((l) => (l.code ? [l.code] : []));
}

/** The tracked links as the account keeps them. */
export function forAccount(links: readonly ShareLink[]): AccountShareLink[] {
  return links.flatMap((l) => (l.code ? [{ code: l.code, created: l.at }] : []));
}

/**
 * The list joined with the account's: every code once, the earliest time
 * wins, the app label stays from this phone, untracked links stay as they are.
 */
export function mergeAccount(links: ShareLink[], account: readonly AccountShareLink[]): ShareLink[] {
  const byCode = new Map<string, ShareLink>();
  const untracked: ShareLink[] = [];
  for (const l of links) {
    if (l.code) byCode.set(l.code, l);
    else untracked.push(l);
  }
  for (const r of account) {
    if (!isShareCode(r.code) || !Number.isFinite(r.created)) continue;
    const mine = byCode.get(r.code);
    byCode.set(r.code, mine ? { ...mine, at: Math.min(mine.at, r.created) } : { code: r.code, at: r.created, app: null });
  }
  return newestFirst([...byCode.values(), ...untracked]);
}
