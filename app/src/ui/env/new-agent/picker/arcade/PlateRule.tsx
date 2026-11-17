import { YStack } from 'tamagui';
import DashedRule from '../../../../common/rows/DashedRule';
import { ROW_GUTTER } from '../../../../common/rows/place';

// A dashed rule across a plate, inside its gutters, between its parts (the
// showcase's, the VS plate's).
export default function PlateRule() {
  return (
    <YStack height={1} marginHorizontal={ROW_GUTTER}>
      <DashedRule />
    </YStack>
  );
}
