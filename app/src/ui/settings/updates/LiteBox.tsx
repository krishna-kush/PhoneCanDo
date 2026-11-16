import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import { LITE_BOX } from './copy';

// The starter build's packing list, as a key box: what is in the box
// (an amber ✓) and what only the full build brings (a red ✗).
export default function LiteBox() {
  return (
    <RowGroup title="In the box" barcode="liteBox">
      {LITE_BOX.map((item) => (
        <RowFrame key={item.name}>
          <XStack alignItems="center" gap="3">
            <PlainText fontFamily="mono" fontSize={18} color={item.inBox ? 'secondaryInk' : 'primary'} width={20} textAlign="center">
              {item.inBox ? '✓' : '✗'}
            </PlainText>
            <YStack flex={1} minWidth={0} gap={2}>
              <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
                {item.name}
              </PlainText>
              <PlainText fontSize={13} color={item.inBox ? 'muted' : 'primary'}>
                {item.note}
              </PlainText>
            </YStack>
          </XStack>
        </RowFrame>
      ))}
    </RowGroup>
  );
}
