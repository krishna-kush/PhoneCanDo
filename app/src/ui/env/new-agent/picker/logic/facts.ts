// What each applicant on the Choose agent step brings: a few facts about
// its kind, each in words and, where it comes in degrees, as a meter of
// three; the applicants that sit out here, by why; and what a screen
// reader hears for each. Pure (zero RN imports).
import type { KindView, MessagingLevel } from '../../../../../../../agents/kit/ts/contract/view.ts';
import type { Offer } from '../../../../../engine/agents/offers.ts';
import { levelTag } from '../../../../messages/logic/levels.ts';
import { scheduleTag } from '../../../../schedule/logic/scheduleCopy.ts';
import { blockedText, offerBadges } from '../../../logic/agentChoice.ts';

export type FactKind = Pick<KindView, 'messaging' | 'schedules' | 'canWake' | 'acp' | 'models' | 'home'>;

export type Fact = {
  term: string;
  value: string;
  /** 0 to METER_MAX; null: a plain fact, with no meter. */
  meter: number | null;
};

/** A full meter. */
export const METER_MAX = 3;

const MESSAGES: Record<MessagingLevel, { meter: number; value: string }> = {
  wakes: { meter: 3, value: 'can wake it' },
  delivered: { meter: 2, value: 'delivered' },
  inbox: { meter: 1, value: 'inbox only' },
  none: { meter: 0, value: 'none' },
};

/** Messages, schedules, local models (each with a meter) and what Home shows. */
export function kindFacts(kind: FactKind): Fact[] {
  const wakes = kind.canWake || kind.acp;
  const models = kind.models.length > 0;
  return [
    { term: 'Messages', ...MESSAGES[kind.messaging] },
    {
      term: 'Schedules',
      value: !kind.schedules ? 'none' : wakes ? 'wakes or starts it' : 'starts it',
      meter: !kind.schedules ? 0 : wakes ? 3 : 2,
    },
    { term: 'Local models', value: models ? 'yes' : 'no', meter: models ? METER_MAX : 0 },
    { term: 'Home', value: kind.home === 'web' ? 'web page' : 'terminal', meter: null },
  ];
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

/** What a screen reader hears for an applicant: its name, badges, how messages and schedules reach it, or why it sits out. */
export function applicantLabel(
  offer: Pick<Offer, 'label' | 'origin' | 'stability' | 'blocked'>,
  kind: Pick<KindView, 'messaging' | 'schedules' | 'canWake' | 'acp'>,
): string {
  return [offer.label, ...offerBadges(offer), levelTag(kind.messaging), scheduleTag(kind), blockedText(offer.blocked)]
    .filter(Boolean)
    .join(', ');
}
