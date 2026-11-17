// How much the public likes an applicant: its repo's GitHub stars, counted
// at build time (fans/counts.ts, app/scripts/make-fans.mjs), short ("5.4k",
// "227k") and as a meter of three; whose they are when its name is not its
// repo's; its venue (stadium, arena, club) and, under it, when the crowd
// was last counted with a cheer of its own. Pure (zero RN imports).
import { dayMonthYear } from '../../../../common/dates.ts';
import { daysFrom, hhmm, HOUR } from '../../../../schedule/logic/clock.ts';
import { FAN_REPOS, FANS, FANS_AT } from '../fans/counts.ts';
import { METER_MAX } from './meter.ts';

/** Stars that fill the meter by a segment each, beyond the first. */
export const LOUDER = 25_000;
export const LOUDEST = 100_000;

/** A kind's stars: a count, null for no public repo, undefined when never counted (a custom kind). */
export function fansOf(kindId: string, counts: Readonly<Record<string, number | null>> = FANS): number | null | undefined {
  return Object.prototype.hasOwnProperty.call(counts, kindId) ? counts[kindId] : undefined;
}

/**
 * Whose stars a kind's are when they aren't its own name's: its repo
 * ("owner/name") when its name doesn't name that repo (a kind named apart
 * from the project it is built on), else null. A name names its repo when
 * either holds the other, in letters and digits of any case ("GitHub
 * Copilot CLI" names copilot-cli).
 */
export function fansRepo(kind: { id: string; label: string }, repos: Readonly<Record<string, string | null>> = FAN_REPOS): string | null {
  const repo = Object.prototype.hasOwnProperty.call(repos, kind.id) ? repos[kind.id] : null;
  if (!repo) return null;
  const name = squash(repoName(repo));
  const label = squash(kind.label);
  return label && (label.includes(name) || name.includes(label)) ? null : repo;
}

/** A repo's name, without its owner: "opencode" of "anomalyco/opencode". */
export const repoName = (repo: string) => repo.slice(repo.indexOf('/') + 1);

/** Stars counted on another name's repo, said as that repo's: "opencode's 227k". */
export const borrowedStars = (repo: string, stars: number) => `${repoName(repo)}'s ${starsText(stars)}`;

/** Over the Fans note of a kind whose stars are its repo's: whose they are. */
export const borrowedNote = (repo: string) => `Stars on ${repo}, the repo its code comes from.`;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** A star count, short: 950, 5.4k, 11k, 227k, 1.2M. */
export function starsText(stars: number): string {
  if (stars < 1000) return String(stars);
  if (stars < 1_000_000) return stars < 100_000 ? `${oneDecimal(stars / 1000)}k` : `${Math.round(stars / 1000)}k`;
  return `${oneDecimal(stars / 1_000_000)}M`;
}

/** The fans meter: one segment for any, two past 25k, full past 100k; none for no stars. */
export function fansMeter(stars: number): number {
  if (stars <= 0) return 0;
  return stars >= LOUDEST ? METER_MAX : stars >= LOUDER ? 2 : 1;
}

/** How big a kind's crowd is, by its stars: a stadium, an arena, a club, or a closed door (no public repo). */
export type Venue = 'stadium' | 'arena' | 'club' | 'closed';

export function venueOf(stars: number | null): Venue {
  if (stars == null) return 'closed';
  return stars >= LOUDEST ? 'stadium' : stars >= LOUDER ? 'arena' : 'club';
}

/** Each venue's cheers. Kinds in one venue each get their own (fansNote), so the line changes with the pick. */
export const CHEERS: Readonly<Record<Venue, readonly string[]>> = {
  stadium: [
    "The crowd's still roaring.",
    "Sold-out stadium. The wave's going round.",
    'Standing room only. Foam fingers up.',
    'Encore chants from the cheap seats.',
    'Fireworks booked. The pyro crew is nervous.',
    'They had to open the overflow car park.',
  ],
  arena: [
    'A packed arena, lighters up.',
    "Arena's buzzing. Merch is nearly gone.",
    'Big crowd. Somebody brought a banner.',
    'Loud enough to hear from the car park.',
    'The mosh pit is mostly polite.',
    'Chanting its name between every song.',
  ],
  club: [
    'A packed club. The front row knows every word.',
    'Small venue, loud crowd.',
    'Cult following. Ask them about it.',
    'Underground hit. Tell your friends.',
    'Sweaty little gig, best night out.',
  ],
  closed: ['No public repo, so no turnstile to count.', 'Private show: no repo to star.', 'Closed doors. The bouncer keeps the list.'],
};

/**
 * Under a kind's Fans: when the crowd was counted (at [at], ISO; null:
 * never) as of [now], then a cheer for its venue, the one its rank there
 * gets (most stars first), so no two kinds in a venue share one.
 */
export function fansNote(
  kindId: string,
  now: number,
  counts: Readonly<Record<string, number | null>> = FANS,
  at: string | null = FANS_AT,
): string {
  const ms = at ? Date.parse(at) : NaN;
  if (Number.isNaN(ms)) return 'No head count yet: the crowd is still finding its seats.';
  const when = countedWhen(now, ms);
  const days = -daysFrom(now, ms);
  if (days >= 7) return `${when} The stands may have filled up since.`;
  const venue = venueOf(fansOf(kindId, counts) ?? null);
  const peers = Object.entries(counts)
    .filter(([, n]) => venueOf(n) === venue)
    .sort(([a, x], [b, y]) => (y ?? 0) - (x ?? 0) || a.localeCompare(b))
    .map(([id]) => id);
  const cheers = CHEERS[venue];
  return `${when} ${cheers[Math.max(0, peers.indexOf(kindId)) % cheers.length]}`;
}

// When the head count was taken, as of [now].
function countedWhen(now: number, ms: number): string {
  const days = -daysFrom(now, ms);
  if (now - ms < HOUR) return 'Head count taken minutes ago.';
  if (days <= 0) return `Head count taken today at ${hhmm(ms)}.`;
  if (days === 1) return `Head count taken yesterday at ${hhmm(ms)}.`;
  if (days < 7) return `Head count taken ${days} days ago.`;
  return `Head count taken ${dayMonthYear(new Date(ms))}.`;
}

const oneDecimal = (n: number) => {
  const tenths = Math.round(n * 10) / 10;
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
};
