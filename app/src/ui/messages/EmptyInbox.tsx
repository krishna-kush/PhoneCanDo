import { YStack } from 'tamagui';
import BoopFace from '../common/face/BoopFace';
import { useNap } from '../common/face/useNap';
import PlainText from '../common/PlainText';
import KeyHead from '../common/rows/KeyHead';
import { ROW_GUTTER } from '../common/rows/place';
import { usePageActive } from '../nav/pageActive';
import { EMPTY_TITLE, napLine } from './logic/messagesCopy';

// The page with nothing to list: one key box with A-01 dozing by the
// inbox and the plain line. A tap wakes it with a hop for a moment, then
// it nods off again (useNap).
export default function EmptyInbox({ text }: { text: string }) {
  const active = usePageActive();
  const nap = useNap();

  return (
    <YStack overflow="hidden" borderWidth={1} borderColor="line" backgroundColor="panel">
      <KeyHead title={EMPTY_TITLE} barcode="emptyInbox" />
      <YStack alignItems="center" gap="3" paddingHorizontal={ROW_GUTTER} paddingTop="5" paddingBottom="4">
        <BoopFace
          mood={nap.mood}
          size={40}
          still={!active}
          label="A-01, asleep by the inbox. Tap it."
          onBoop={nap.boop}
          hitSlop={16}
        />
        <PlainText fontSize={14} color="muted" textAlign="center">
          {text}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint" textAlign="center">
          {napLine(nap.up)}
        </PlainText>
      </YStack>
    </YStack>
  );
}
