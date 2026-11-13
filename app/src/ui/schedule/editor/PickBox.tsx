import { XStack } from 'tamagui';
import { HIT } from '../../common/globals';
import PlainText from '../../common/PlainText';

type Props = {
  value: string;
  onPress: () => void;
  /** What a screen reader says it picks: "Day", "Time". */
  accessibilityLabel: string;
};

// A day or a time as a box you tap to change it in Android's own dialog:
// the value, and a mark saying it opens a picker.
export default function PickBox({ value, onPress, accessibilityLabel }: Props) {
  return (
    <XStack
      minHeight={HIT.minTouch}
      minWidth={120}
      paddingHorizontal="3"
      alignItems="center"
      justifyContent="space-between"
      gap="3"
      borderWidth={1}
      borderColor="lineStrong"
      opacity="press:0.7"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${accessibilityLabel}: ${value}`}
      accessibilityHint="Opens a picker"
    >
      <PlainText fontFamily="mono" fontSize={15} fontWeight="600" numberOfLines={1}>
        {value}
      </PlainText>
      <PlainText fontFamily="mono" fontSize={12} color="dim">
        ▾
      </PlainText>
    </XStack>
  );
}
