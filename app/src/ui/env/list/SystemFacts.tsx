import { XStack } from 'tamagui';
import type { Fact } from '../logic/systemFacts';
import PlainText from '../../common/PlainText';
import { ROW_GUTTER } from '../../common/rows/place';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';

// A system's facts as a two-column table in a RowGroup: the label in mono
// on the left, the value on the right, dashed rules between.
export default function SystemFacts({ facts }: { facts: Fact[] }) {
  return (
    <RowGroup title="Details" barcode="systemDetails">
      {facts.map((f) => (
        <RowFrame key={f.label} bare>
          <XStack alignItems="center" gap="3" minHeight={44} paddingHorizontal={ROW_GUTTER}>
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="dim" textTransform="uppercase" width={84}>
              {f.label}
            </PlainText>
            <PlainText fontSize={15} flex={1} minWidth={0} numberOfLines={2} userSelect="text">
              {f.value}
            </PlainText>
          </XStack>
        </RowFrame>
      ))}
    </RowGroup>
  );
}
