import { YStack } from 'tamagui';
import type { MapInk } from '../../logic/ramMap';
import { INK, pct } from './inks';

// A row's share of the phone's memory: its block on the strip drawn again
// under the row, in the same ink, on a hairline track as wide as the
// phone's whole memory. Nothing for a row we could not read.
export default function ShareBar({ share, ink }: { share: number; ink: MapInk }) {
  if (!(share > 0)) return null;
  return (
    <YStack height={3} marginTop={2} backgroundColor="line" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <YStack height={3} width={pct(Math.min(share, 1))} minWidth={2} backgroundColor={INK[ink]} />
    </YStack>
  );
}
