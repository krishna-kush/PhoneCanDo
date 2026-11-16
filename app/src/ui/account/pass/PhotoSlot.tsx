import type { ReactNode } from 'react';
import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';

// The pass's photo: a frame on the darker ground with what stands in for a
// photo (we never load the real one) and a tiny caption; blank, an empty
// dashed slot waiting for someone.
export default function PhotoSlot({ children, caption, blank }: { children?: ReactNode; caption: string; blank: boolean }) {
  return (
    <YStack alignItems="center" gap={4} flexShrink={0}>
      <YStack
        width={72}
        height={84}
        alignItems="center"
        justifyContent="center"
        borderWidth={1}
        borderStyle={blank ? 'dashed' : 'solid'}
        borderColor={blank ? 'lineStrong' : 'line'}
        backgroundColor={blank ? 'transparent' : 'bg'}
      >
        {children}
      </YStack>
      <PlainText fontFamily="mono" fontSize={8} letterSpacing={1} textTransform="uppercase" color="faint" textAlign="center" width={80}>
        {caption}
      </PlainText>
    </YStack>
  );
}
