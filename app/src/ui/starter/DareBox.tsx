import { XStack, YStack } from 'tamagui';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import { COPY_DARE, dareLabel, ROLL } from './copy';
import { dieFace, type DareSet } from './logic/dares';

type Props = {
  set: DareSet;
  dare: string;
  /** Rolls so far: the die shows a new face each one. */
  rolls: number;
  onRoll: () => void;
  /** A Copy button of its own (the hands dares; the others go with the mission's button). */
  onCopy?: () => void;
};

// A dare in a box: the die and Roll above it, the dare under them (a
// command in mono, after a prompt sign).
export default function DareBox({ set, dare, rolls, onRoll, onCopy }: Props) {
  return (
    <YStack borderWidth={1} borderColor="line" padding="3" gap="2">
      <XStack alignItems="center" justifyContent="space-between" gap="2">
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
          {dareLabel(set)}
        </PlainText>
        <XStack
          alignItems="center"
          gap="2"
          onPress={onRoll}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${ROLL}: another one`}
        >
          <PlainText fontSize={22} color="secondaryInk">
            {dieFace(rolls)}
          </PlainText>
          <PlainText fontFamily="mono" fontSize={12} letterSpacing={1.2} textTransform="uppercase" color="primary">
            {ROLL}
          </PlainText>
        </XStack>
      </XStack>
      <PlainText fontFamily={set === 'shell' ? 'mono' : undefined} fontSize={set === 'shell' ? 13 : 15} userSelect="text">
        {set === 'shell' ? `$ ${dare}` : `“${dare}”`}
      </PlainText>
      {onCopy ? (
        <XStack justifyContent="flex-end">
          <AppButton variant="secondary" onPress={onCopy}>
            {COPY_DARE}
          </AppButton>
        </XStack>
      ) : null}
    </YStack>
  );
}
