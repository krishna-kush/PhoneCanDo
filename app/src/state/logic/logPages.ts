// How much of the agent message log a Messages page reads: a few, enough
// for its first screen, as it opens; then a page more each time the list
// nears its end, up to all the runner keeps. The runner hands back only
// "the newest N", so each page asks for more from the top. Pure (zero RN
// imports): scripts/vectors/test_messages.js checks it.

/** Read as the page opens: enough for its first screen, small enough not to hold up its slide. */
export const FIRST_READ = 8;

/** Read more each time the list nears its end. */
export const PAGE = 30;

/** How many to ask for next; `most` is all the runner keeps. */
export function nextLimit(limit: number, most: number): number {
  return Math.min(limit + PAGE, most);
}

/**
 * How many to ask for once new messages came in on top (ids only grow):
 * as many more, so the oldest the page shows stays on it; the same before
 * the page has read any (`newestRead` null).
 */
export function withNewOnTop(limit: number, newestRead: number | null, newestNow: number, most: number): number {
  if (newestRead == null) return limit;
  return Math.min(limit + Math.max(0, newestNow - newestRead), most);
}

/** Whether older ones are left: the last read came back full and asked for less than all there are. */
export function hasOlder(got: number, limit: number, most: number): boolean {
  return got >= limit && limit < most;
}
