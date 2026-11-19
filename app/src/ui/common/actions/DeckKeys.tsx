import { XStack, YStack } from 'tamagui';
import { DANGER_ZONE } from './copy';
import DeckKey from './DeckKey';
import { deal, pairsOf } from './logic/deal';
import type { DeckAction } from './types';
import ZoneRule from './ZoneRule';

type Props = {
  /** The buttons in their page's order; a hidden one may be null or false. */
  actions: readonly (DeckAction | null | false | undefined)[];
};

// A deck's keys on their own, laid out by what each does (logic/deal.ts):
// the main act wide and red, the others in pairs, and the ones that can't
// be undone under a rule of their own. A page puts them in its Controls
// box (ActionDeck); a pop-up, which has a frame of its own, as they are.
export default function DeckKeys({ actions }: Props) {
  const dealt = deal(actions);
  return (
    <YStack gap={12}>
      {dealt.go.map((a) => (
        <DeckKey key={a.label} action={a} />
      ))}
      {pairsOf([...dealt.more, ...dealt.back]).map((row) => (
        <XStack key={row.map((a) => a.label).join('|')} gap={12}>
          {row.map((a) => (
            <DeckKey key={a.label} action={a} flex={1} />
          ))}
        </XStack>
      ))}
      {dealt.danger.length > 0 ? (
        <YStack gap={12} paddingTop="1">
          <ZoneRule ink="primary">{DANGER_ZONE}</ZoneRule>
          {dealt.danger.map((a) => (
            <DeckKey key={a.label} action={a} />
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}
