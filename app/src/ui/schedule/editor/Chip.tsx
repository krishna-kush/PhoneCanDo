import { XStack } from 'tamagui';
import { HIT } from '../../common/globals';
import PlainText from '../../common/PlainText';

type ChipProps = {
  label: string;
  on: boolean;
  onPress: () => void;
  /** One of a few (radio), any number (checkbox), or a plain button (a step). */
  role?: 'radio' | 'checkbox' | 'button';
  /** What a screen reader says when the label is short ("Mon"). */
  accessibilityLabel?: string;
};

// A square chip, the picked one filled in (the run caps' chips, with words).
export function Chip({ label, on, onPress, role = 'radio', accessibilityLabel }: ChipProps) {
  return (
    <XStack
      minHeight={HIT.minTouch}
      minWidth={HIT.minTouch}
      paddingHorizontal="3"
      alignItems="center"
      justifyContent="center"
      borderWidth={1}
      borderColor={on ? 'primary' : 'lineStrong'}
      backgroundColor={on ? 'primary' : 'transparent'}
      opacity="press:0.7"
      onPress={onPress}
      accessibilityRole={role}
      accessibilityState={role === 'button' ? undefined : { checked: on }}
      accessibilityLabel={accessibilityLabel ?? label}
    >
      <PlainText fontFamily="mono" fontSize={13} fontWeight="600" color={on ? 'onPrimary' : 'fg'} numberOfLines={1}>
        {label}
      </PlainText>
    </XStack>
  );
}

type Option<T extends string> = { value: T; label: string };

// One of a few, as a wrapping row of chips.
export function ChoiceChips<T extends string>({
  options,
  value,
  onPick,
}: {
  options: readonly Option<T>[];
  value: T | null;
  onPick: (value: T) => void;
}) {
  return (
    <XStack flexWrap="wrap" gap="2" accessibilityRole="radiogroup">
      {options.map((o) => (
        <Chip key={o.value} label={o.label} on={o.value === value} onPress={() => onPick(o.value)} />
      ))}
    </XStack>
  );
}
