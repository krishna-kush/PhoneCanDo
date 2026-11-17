// The showcase's foot: the picked applicant's power move (what you type in
// its own app to do what it is best known for) and How to play, its
// official pages to open in the browser. From the kind's `about`. Pure
// (zero RN imports).
import type { KindAbout } from '../../../../../../../agents/kit/ts/contract/view.ts';

export type PlayLinkKey = 'guide' | 'keys' | 'plans' | 'home';

export type PlayLink = { key: PlayLinkKey; label: string; url: string };

/** The links in the order a newcomer wants them, each in a word or two; the website by its own name. */
const LINKS: readonly { key: PlayLinkKey; label: string }[] = [
  { key: 'guide', label: 'Guide' },
  { key: 'keys', label: 'Get a key' },
  { key: 'plans', label: 'Plans' },
  { key: 'home', label: 'Website' },
];

/** Only a whole https address opens: a user kind's manifest is not checked the way ours are. */
const HTTPS = /^https:\/\/\S+$/;

/** An address's site, without its www.: "opencode.ai" of "https://www.opencode.ai/docs". */
const SITE = /^https:\/\/(?:www\.)?([^/?#:@]+)/;

/**
 * The pages How to play opens, those its kind names, in LINKS order. The
 * website is named by its site ("opencode.ai"), so whose pages these are
 * shows even when the agent goes by a name of our own.
 */
export function playLinks(about: KindAbout | null): PlayLink[] {
  const links: Partial<Record<PlayLinkKey, unknown>> = about?.links ?? {};
  return LINKS.flatMap(({ key, label }) => {
    const url = links[key];
    if (typeof url !== 'string' || !HTTPS.test(url)) return [];
    return [{ key, label: key === 'home' ? (SITE.exec(url)?.[1] ?? label) : label, url }];
  });
}

/** Its power move (what to type in its own app, and what that does), or null when its kind names none. */
export function powerMove(about: KindAbout | null): { keys: string; does: string } | null {
  const move: unknown = about?.move;
  if (move == null || typeof move !== 'object') return null;
  const { keys, does } = move as { keys?: unknown; does?: unknown };
  return typeof keys === 'string' && keys && typeof does === 'string' && does ? { keys, does } : null;
}
