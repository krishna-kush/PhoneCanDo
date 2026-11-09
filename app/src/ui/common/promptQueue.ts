// The bridge prompts (unlock, accessibility setup, a link to open) as the UI
// queues them, and the lines that say who is asking. Pure (no React Native
// imports).
import type { BridgePrompt } from '../../engine/runner';

// What to show: the native list (oldest first) minus the prompts this UI
// has already answered. Native drops an answered prompt a moment later,
// when its waiting request notices, and the dialog must not flash it back.
export function visiblePrompts(
  pending: readonly BridgePrompt[],
  answered: ReadonlySet<string>,
): BridgePrompt[] {
  return pending.filter((p) => !answered.has(p.requestId));
}

// Answered ids native no longer lists can be forgotten.
export function forgetGone(answered: ReadonlySet<string>, pending: readonly BridgePrompt[]): Set<string> {
  const live = new Set(pending.map((p) => p.requestId));
  return new Set([...answered].filter((id) => live.has(id)));
}

export function samePrompts(a: readonly BridgePrompt[], b: readonly BridgePrompt[]): boolean {
  return a.length === b.length && a.every((p, i) => p.requestId === b[i].requestId);
}

/** The dialog's heading for any prompt: which agent is asking. */
export function askerTitle(p: BridgePrompt): string {
  return `${p.agentName || 'An agent'} wants to control the phone`;
}

/** The host a link goes to, as the user should judge it: no user info before
    an `@`, lowercased, its port kept (a sign-in may call back to localhost). */
export function urlHost(url: string): string {
  const m = /^https?:\/\/([^/?#]*)/i.exec(url.trim());
  if (!m) return url.trim();
  const authority = m[1];
  return authority.slice(authority.lastIndexOf('@') + 1).toLowerCase();
}

/** Only web links open from a prompt (native checks the same before it asks). */
export function isWebLink(url: string | null | undefined): boolean {
  return typeof url === 'string' && /^https?:\/\/[^\s]+$/i.test(url.trim());
}

/** The open_url dialog's heading: "gemini wants to open accounts.google.com". */
export function openUrlTitle(p: Pick<BridgePrompt, 'agentName' | 'url'>): string {
  const host = p.url ? urlHost(p.url) : '';
  return `${p.agentName || 'An agent'} wants to open ${host || 'a link'}`;
}

// One unlock opens the gate for the whole phone, so it answers every
// waiting unlock request at once.
export function unlockCoversLine(othersWaiting: number): string {
  if (othersWaiting <= 0) return '';
  return othersWaiting === 1
    ? 'One more request is waiting; this unlock covers it too.'
    : `${othersWaiting} more requests are waiting; this unlock covers them too.`;
}

// Prompts after this one, of any kind; each gets its own turn.
export function waitingLine(othersWaiting: number): string {
  if (othersWaiting <= 0) return '';
  return othersWaiting === 1
    ? 'One more request is waiting after this one.'
    : `${othersWaiting} more requests are waiting after this one.`;
}
