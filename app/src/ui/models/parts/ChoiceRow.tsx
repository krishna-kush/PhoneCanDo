import { XStack, YStack } from 'tamagui';
import type { ModelDates } from '../../../engine/models/types';
import { datesLine } from '../logic/dates';
import DatesLine from './DatesLine';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import SquareMark from '../../common/rows/SquareMark';

type Props = {
  label: string;
  note: string;
  /** A model's release and training-data dates, under the note. */
  dates?: ModelDates | null;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

// One choice of a pick-one list (an agent's model), a row of its RowGroup:
// the square mark (it pops in when picked), its label and what it means,
// the whole row a radio button; the picked row wears RowFrame's red bar.
export default function ChoiceRow({ label, note, dates, selected, disabled = false, onPress }: Props) {
  const when = datesLine(dates);
  return (
    <RowFrame
      press={{
        onPress,
        role: 'radio',
        label: when ? `${label}, ${note}, ${when}` : `${label}, ${note}`,
        state: { checked: selected, disabled },
      }}
      dim={disabled}
      picked={selected}
    >
      <XStack alignItems="center" gap="3">
        <SquareMark on={selected} />
        <YStack flex={1} minWidth={0} gap="1">
          <PlainText fontSize={16} fontWeight="600" numberOfLines={2}>
            {label}
          </PlainText>
          <PlainText fontSize={13} color="dim">
            {note}
          </PlainText>
          <DatesLine dates={dates} />
        </YStack>
      </XStack>
    </RowFrame>
  );
}
