import { YStack } from 'tamagui';
import type { Offer } from '../../../engine/agents/offers';
import { noOfferText } from '../logic/agentChoice';
import Note from '../parts/Note';
import KindOption from './KindOption';

type Props = { offers: readonly Offer[]; selected: string | null; onSelect: (kindId: string) => void };

// The kinds a creation step offers, in offers.ts order, one picked. First
// launch shows it too.
export default function AgentPicker({ offers, selected, onSelect }: Props) {
  const none = noOfferText(offers);
  return (
    <YStack gap="$2" accessibilityRole="radiogroup">
      {offers.map((o) => (
        <KindOption key={o.id} offer={o} selected={o.id === selected} onSelect={() => onSelect(o.id)} />
      ))}
      {none ? <Note tone="error">{none}</Note> : null}
    </YStack>
  );
}
