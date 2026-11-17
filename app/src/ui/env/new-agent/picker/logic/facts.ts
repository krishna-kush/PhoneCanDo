// What each applicant on the Choose agent step brings: a few facts about
// its kind, each in words and, where it comes in degrees, as a meter of
// three (its cost as a coin instead); the applicants that sit out here, by
// why; and what a screen reader hears for each. Pure (zero RN imports).
import type { KindView, MessagingLevel } from '../../../../../../../agents/kit/ts/contract/view.ts';
import type { Offer } from '../../../../../engine/agents/offers.ts';
import { levelTag } from '../../../../messages/logic/levels.ts';
import { scheduleTag } from '../../../../schedule/logic/scheduleCopy.ts';
import { blockedText, offerBadges } from '../../../logic/agentChoice.ts';
import { HOUSE_PICK } from '../copy.ts';
import { COIN_WORDS, coinOf, costOf, type Coin } from './coin.ts';
import { borrowedNote, borrowedStars, fansMeter, fansNote, fansOf, fansRepo, starsText } from './fans.ts';
import { METER_MAX } from './meter.ts';

export type FactKind = Pick<KindView, 'id' | 'label' | 'messaging' | 'schedules' | 'canWake' | 'acp' | 'models' | 'home' | 'about'>;

export type Fact = {
  term: string;
  value: string;
  /** 0 to METER_MAX; null: a plain fact, with no meter. */
  meter: number | null;
  /** The cost's coin, drawn where a meter would be. */
  coin?: Coin;
  /** A line under its words. */
  note?: string;
};

/** How far messages reach it, as its meter and words; the stat key explains each. */
export const MESSAGES: Record<MessagingLevel, { meter: number; value: string }> = {
  wakes: { meter: METER_MAX, value: 'can wake it' },
  delivered: { meter: 2, value: 'delivered' },
  inbox: { meter: 1, value: 'inbox only' },
  none: { meter: 0, value: 'none' },
};

/** How a scheduled task reaches it: wakes it or starts it, only starts it, or never. */
export type ScheduleLevel = 'wakes' | 'starts' | 'none';

/** Each schedule level as its meter and words, best first; the stat key explains each. */
export const SCHEDULES: Record<ScheduleLevel, { meter: number; value: string }> = {
  wakes: { meter: METER_MAX, value: 'wakes or starts it' },
  starts: { meter: 2, value: 'starts it' },
  none: { meter: 0, value: 'none' },
};

/** Its fans' words when its kind has no public repo to star. */
export const NO_REPO = 'no public repo';

/**
 * Cost (a coin), fans (for a kind whose stars were counted, with when, as
 * of [now], and whose they are when not its own name's), messages and
 * schedules (each a meter), and what Home shows.
 */
export function kindFacts(kind: FactKind, now: number): Fact[] {
  const cost = costOf(kind);
  const stars = fansOf(kind.id);
  return [
    { term: 'Cost', value: cost.value, meter: null, coin: cost.coin, note: cost.note },
    ...(stars === undefined ? [] : [fansFact(stars, fansRepo(kind), fansNote(kind.id, now))]),
    { term: 'Messages', ...MESSAGES[kind.messaging] },
    { term: 'Schedules', ...SCHEDULES[scheduleLevel(kind)] },
    { term: 'Home', value: kind.home === 'web' ? 'web page' : 'terminal', meter: null },
  ];
}

// Its stars, short, on the fans meter, said as [repo]'s when they are
// another name's; null: no public repo.
function fansFact(stars: number | null, repo: string | null, note: string): Fact {
  if (stars == null) return { term: 'Fans', value: NO_REPO, meter: 0, note };
  if (repo) return { term: 'Fans', value: borrowedStars(repo, stars), meter: fansMeter(stars), note: `${borrowedNote(repo)} ${note}` };
  return { term: 'Fans', value: `${starsText(stars)} stars`, meter: fansMeter(stars), note };
}

/** How a scheduled task reaches an agent of [kind]. */
export function scheduleLevel(kind: Pick<KindView, 'schedules' | 'canWake' | 'acp'>): ScheduleLevel {
  if (!kind.schedules) return 'none';
  return kind.canWake || kind.acp ? 'wakes' : 'starts';
}

/** The applicants that can't be picked here, a line per reason: "Needs a Linux env: Aider, Cline". */
export function sittingOut(offers: readonly Pick<Offer, 'label' | 'blocked'>[]): string[] {
  const byReason = new Map<string, string[]>();
  for (const o of offers) {
    const reason = blockedText(o.blocked);
    if (reason) byReason.set(reason, [...(byReason.get(reason) ?? []), o.label]);
  }
  return [...byReason].map(([reason, labels]) => `${reason}: ${labels.join(', ')}`);
}

/** What a screen reader hears for an applicant: its name, the house pick's stamp, badges, how it plays free, how messages and schedules reach it, or why it sits out. */
export function applicantLabel(
  offer: Pick<Offer, 'label' | 'origin' | 'stability' | 'blocked'>,
  kind: Pick<KindView, 'isDefault' | 'messaging' | 'schedules' | 'canWake' | 'acp' | 'about' | 'models'>,
): string {
  const coin = coinOf(kind);
  return [
    offer.label,
    kind.isDefault ? HOUSE_PICK : '',
    ...offerBadges(offer),
    coin === 'slot' ? '' : COIN_WORDS[coin],
    levelTag(kind.messaging),
    scheduleTag(kind),
    blockedText(offer.blocked),
  ]
    .filter(Boolean)
    .join(', ');
}
