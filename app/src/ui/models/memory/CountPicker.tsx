import { XStack, YStack } from 'tamagui';
import type { MemoryCount } from '../../../engine/models/types';
import PlainText from '../../common/PlainText';
import SectionTitle from '../../common/SectionTitle';
import { countChip, countNote, countOptions, type CountKind } from '../logic/memory';

type Props = {
  title: string;
  kind: CountKind;
  count: MemoryCount;
  /** Null: Auto. */
  value: number | null;
  /** How many the planner finds room for now (saved chats only). */
  fitsNow?: number | null;
  /** Chats go to storage instead of RAM (saved chats only). */
  onStorage?: boolean;
  disabled: boolean;
  onPick: (value: number | null) => void;
};

// One count of the Memory setting's Advanced as a row of square chips
// (Auto, then each number the planner offers here), the picked one filled
// in, then what it means and what Auto picks.
export default function CountPicker({ title, kind, count, value, fitsNow = null, onStorage = false, disabled, onPick }: Props) {
  return (
    <YStack gap="2">
      <SectionTitle>{title}</SectionTitle>
      <XStack flexWrap="wrap" gap="2" accessibilityRole="radiogroup" accessibilityLabel={title}>
        {countOptions(count).map((option) => {
          const on = option === value;
          const label = countChip(option);
          return (
            <XStack
              key={label}
              minWidth={48}
              height={48}
              paddingHorizontal="2"
              alignItems="center"
              justifyContent="center"
              borderWidth={1}
              borderColor={on ? 'primary' : 'lineStrong'}
              backgroundColor={on ? 'primary' : 'transparent'}
              opacity={disabled ? 0.5 : 'press:0.7'}
              onPress={disabled || on ? undefined : () => onPick(option)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={option == null ? `Auto, ${count.auto}` : label}
            >
              <PlainText fontFamily="mono" fontSize={16} fontWeight="600" color={on ? 'onPrimary' : 'fg'}>
                {label}
              </PlainText>
            </XStack>
          );
        })}
      </XStack>
      <PlainText fontSize={14} color="muted">
        {countNote(kind, value, count, fitsNow, onStorage)}
      </PlainText>
    </YStack>
  );
}
