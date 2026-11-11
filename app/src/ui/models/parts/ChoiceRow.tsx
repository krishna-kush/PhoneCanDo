import { Text, XStack, YStack } from 'tamagui';
import type { ModelDates } from '../../../engine/models/types';
import { useTheme } from '../../common/globals';
import { datesLine } from '../logic/dates';
import DatesLine from './DatesLine';

type Props = {
  label: string;
  note: string;
  /** A model's release and training-data dates, under the note. */
  dates?: ModelDates | null;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

// One choice of a pick-one list (an agent's model): a square mark, its
// label and what it means, the whole row a radio button.
export default function ChoiceRow({ label, note, dates, selected, disabled = false, onPress }: Props) {
  const t = useTheme();
  const when = datesLine(dates);
  return (
    <XStack
      alignItems="center"
      gap="3"
      minHeight={64}
      padding="3"
      borderWidth={1}
      borderColor={selected ? t.primary : t.line}
      backgroundColor={t.panel}
      opacity={disabled ? 0.5 : '1 press:0.9'}
      scale={disabled ? undefined : 'press:0.99'}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={when ? `${label}, ${note}, ${when}` : `${label}, ${note}`}
    >
      <Text fontFamily="mono" fontSize={14} width={16} textAlign="center" color={selected ? t.primary : t.faint}>
        {selected ? '■' : '□'}
      </Text>
      <YStack flex={1} minWidth={0} gap="1">
        <Text fontSize={16} fontWeight="600" numberOfLines={2}>
          {label}
        </Text>
        <Text fontSize={13} color={t.dim}>
          {note}
        </Text>
        <DatesLine dates={dates} />
      </YStack>
    </XStack>
  );
}
