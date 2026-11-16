import { createContext, type ReactNode, useContext } from 'react';
import { YStack } from 'tamagui';
import PlainText from '../PlainText';

// The room over the bench for what sits on it (a face with its hat, a
// raised cartridge), and the widest a place grows on a short bench.
const ART_H = 44;
const MAX_W = 56;

// A place's set width on a bench that scrolls (Bench.tsx); null: places
// share the row evenly.
export const PlaceWidth = createContext<number | null>(null);

type Props = {
  /** What sits on it: a face, a cartridge, the ∞. */
  children?: ReactNode;
  /** Under the bench: its number, or the first place's word. */
  label: string;
  /** Inside the count: its stretch of bench lit amber, its number in ink. */
  lit: boolean;
  /** The picked one: its number red. */
  picked: boolean;
  disabled: boolean;
  onPress: () => void;
  /** What a screen reader hears. */
  a11y: string;
};

// One place on a bench (Bench.tsx), a radio button: what sits on it, its
// stretch of bench and its number under that.
export default function Place({ children, label, lit, picked, disabled, onPress, a11y }: Props) {
  const width = useContext(PlaceWidth);
  return (
    <YStack
      flex={width == null ? 1 : undefined}
      width={width ?? undefined}
      maxWidth={MAX_W}
      alignItems="center"
      gap={5}
      paddingTop="1"
      paddingBottom="2"
      backgroundColor={disabled ? undefined : 'press:panel2'}
      opacity={disabled ? 0.5 : 1}
      onPress={disabled || picked ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: picked, disabled }}
      accessibilityLabel={a11y}
    >
      <YStack height={ART_H} justifyContent="flex-end" alignItems="center">
        {children}
      </YStack>
      <YStack alignSelf="stretch" marginHorizontal={2} height={3} backgroundColor={lit ? 'secondary' : 'line'} />
      <PlainText fontFamily="mono" fontSize={11} fontWeight={picked ? '600' : '400'} color={picked ? 'primary' : lit ? 'fg' : 'faint'}>
        {label}
      </PlainText>
    </YStack>
  );
}
