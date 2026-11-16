import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from '../PlainText';
import KeyBarcode from './barcode/KeyBarcode';
import { ROW_GUTTER } from './place';

// A box's title strip, as the site's `.key-label` over a figure's key: a
// figure label (an amber dash, the title in amber mono capitals, on two
// lines when long) and, at its right, a barcode with an easter egg in it
// (barcode/), then `trailing` (an open-close arrow).
export default function KeyHead({ title, trailing }: { title: string; trailing?: ReactNode }) {
  return (
    <XStack
      alignItems="center"
      gap="2"
      paddingHorizontal={ROW_GUTTER}
      paddingVertical="2"
      minHeight={36}
      borderBottomWidth={1}
      borderColor="line"
      backgroundColor="bg"
    >
      <YStack width={16} height={1} backgroundColor="secondary" />
      <PlainText
        fontFamily="mono"
        fontSize={11}
        fontWeight="600"
        letterSpacing={1.6}
        textTransform="uppercase"
        color="secondaryInk"
        numberOfLines={2}
        flexShrink={1}
      >
        {title}
      </PlainText>
      <XStack flex={1} minWidth={8} />
      <KeyBarcode title={title} />
      {trailing}
    </XStack>
  );
}
