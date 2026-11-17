import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import FlipText from './flip/FlipText';

type Props = {
  /** The big line: "09", "Tue 18 Nov". */
  value: string;
  /** A small line over it: "Tomorrow". */
  over?: string;
  /** Opens Android's dialog; absent, it only shows the value. */
  onPress?: () => void;
  /** What a screen reader says it picks: "Day", "Hour". */
  accessibilityLabel: string;
  /** The value's size; 26 for clock digits. */
  size?: number;
  /** A set width; it shares the row when left out. */
  width?: number;
};

// A day or a time on a split-flap tile you tap to change it in Android's
// own dialog: the value in big mono with the board's gap cut across its
// middle, a small amber line over it, and a ▾ in its corner saying it
// opens a picker. A new value falls in like a flap (FlipText).
export default function PickBox({ value, over, onPress, accessibilityLabel, size = 26, width }: Props) {
  return (
    <YStack
      flex={width == null ? 1 : undefined}
      width={width}
      minHeight={64}
      paddingHorizontal="2"
      paddingVertical="2"
      gap={2}
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderColor="lineStrong"
      backgroundColor="panel2"
      opacity="press:0.7"
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${accessibilityLabel}: ${over ? `${over}, ` : ''}${value}`}
      accessibilityHint={onPress ? 'Opens a picker' : undefined}
    >
      {over ? (
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="secondaryInk" numberOfLines={1}>
          {over}
        </PlainText>
      ) : null}
      <XStack>
        <FlipText text={value} fontFamily="mono" fontSize={size} fontWeight="600" numberOfLines={1} />
        <YStack position="absolute" left={-4} right={-4} top="50%" height={1} backgroundColor="panel2" />
      </XStack>
      {onPress ? (
        <YStack position="absolute" right={6} bottom={4}>
          <PlainText fontFamily="mono" fontSize={10} color="dim">
            ▾
          </PlainText>
        </YStack>
      ) : null}
    </YStack>
  );
}
