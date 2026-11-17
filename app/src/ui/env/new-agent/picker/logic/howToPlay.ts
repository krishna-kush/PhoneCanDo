// The showcase's foot: the picked applicant's power move (what you type in
// its own app to do what it is best known for) and How to play, its
// official pages to open in the browser. From the kind's `about`. Pure
// (zero RN imports).
import type { KindAbout } from '../../../../../../../agents/kit/ts/contract/view.ts';

export type PlayLinkKey = 'guide' | 'keys' | 'plans' | 'home';

export type PlayLink = { key: PlayLinkKey; label: string; url: string };

/** The links in the order a newcomer wants them, each in a word or two. */
const LINKS: readonly { key: PlayLinkKey; label: string }[] = [
  { key: 'guide', label: 'Guide' },
  { key: 'keys', label: 'Get a key' },
  { key: 'plans', label: 'Plans' },
  { key: 'home', label: 'Website' },
];

/** Only a whole https address opens: a user kind's manifest is not checked the way ours are. */
const HTTPS = /^https:\/\/\S+$/;

/** The pages How to play opens, those its kind names, in LINKS order. */
export function playLinks(about: KindAbout | null): PlayLink[] {
  const links: Partial<Record<PlayLinkKey, unknown>> = about?.links ?? {};
  return LINKS.flatMap(({ key, label }) => {
    const url = links[key];
    return typeof url === 'string' && HTTPS.test(url) ? [{ key, label, url }] : [];
  });
}

/** Its power move (what to type in its own app, and what that does), or null when its kind names none. */
export function powerMove(about: KindAbout | null): { keys: string; does: string } | null {
  const move: unknown = about?.move;
  if (move == null || typeof move !== 'object') return null;
  const { keys, does } = move as { keys?: unknown; does?: unknown };
  return typeof keys === 'string' && keys && typeof does === 'string' && does ? { keys, does } : null;
}
