import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { ROW_GUTTER } from '../../common/rows/place';
import RowGroup from '../../common/rows/RowGroup';
import { CREDITS } from './copy';

// The end credits, as a film rolls them: each role set right of a middle
// line, who played it left of it, in one key box.
export default function Credits() {
  return (
    <RowGroup title="Credits" barcode="credits">
      <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3" gap="2">
        {CREDITS.map((c) => (
          <XStack key={c.role} gap="3" alignItems="baseline">
            <YStack flex={1} alignItems="flex-end">
              <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint" textAlign="right">
                {c.role}
              </PlainText>
            </YStack>
            <YStack flex={1}>
              <PlainText fontSize={14} fontWeight="500">
                {c.name}
              </PlainText>
            </YStack>
          </XStack>
        ))}
      </YStack>
    </RowGroup>
  );
}
