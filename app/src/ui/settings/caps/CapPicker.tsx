import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { capChip, capName, capNote, capOptions, type Cap, type CapKind } from '../logic/caps';

type Props = {
  kind: CapKind;
  value: Cap;
  onPick: (cap: Cap) => void;
  disabled?: boolean;
};

// One cap as a row of square chips (∞, 1, 2, 3…), the picked one filled
// in, then its playful name and what it does in plain words.
export default function CapPicker({ kind, value, onPick, disabled = false }: Props) {
  return (
    <YStack gap="2">
      <XStack flexWrap="wrap" gap="2" accessibilityRole="radiogroup">
        {capOptions(kind, value).map((cap) => {
          const on = cap === value;
          return (
            <XStack
              key={capChip(cap)}
              width={48}
              height={48}
              alignItems="center"
              justifyContent="center"
              borderWidth={1}
              borderColor={on ? 'primary' : 'lineStrong'}
              backgroundColor={on ? 'primary' : 'transparent'}
              opacity={disabled ? 0.5 : 'press:0.7'}
              onPress={disabled || on ? undefined : () => onPick(cap)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={`${cap == null ? 'No cap' : cap}, ${capName(kind, cap)}`}
            >
              <PlainText fontFamily="mono" fontSize={cap == null ? 20 : 16} fontWeight="600" color={on ? 'onPrimary' : 'fg'}>
                {capChip(cap)}
              </PlainText>
            </XStack>
          );
        })}
      </XStack>
      <PlainText fontFamily="mono" fontSize={12} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
        {`${capChip(value)} · ${capName(kind, value)}`}
      </PlainText>
      <PlainText fontSize={14} color="muted">
        {capNote(kind, value)}
      </PlainText>
    </YStack>
  );
}
