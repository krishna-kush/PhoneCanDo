import { YStack } from 'tamagui';
import type { Offer } from '../../../../../engine/agents/offers';
import PlainText from '../../../../common/PlainText';
import { SITTING_OUT } from '../copy';
import { sittingOut } from '../logic/facts';

// Under the arcade's grid, where who can't be picked here sleeps dimmed:
// who they are, a line per reason. Nothing when everyone can.
export default function SittingOutNote({ offers }: { offers: readonly Offer[] }) {
  const lines = sittingOut(offers);
  if (!lines.length) return null;
  return (
    <YStack gap={3}>
      <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.2} textTransform="uppercase" color="faint">
        {SITTING_OUT}
      </PlainText>
      {lines.map((l) => (
        <PlainText key={l} fontSize={13} color="dim">
          {l}
        </PlainText>
      ))}
    </YStack>
  );
}
