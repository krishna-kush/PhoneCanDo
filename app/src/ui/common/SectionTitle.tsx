import { XStack, YStack } from 'tamagui';
import PlainText from './PlainText';

// The site's `.kicker`: a red square + mono uppercase micro-label. Replaces
// the bold amber sans heading, which read like a stock settings app.
export default function SectionTitle({ children }: { children: string }) {
  return (
    <XStack alignItems="center" gap="2" marginTop="3">
      <YStack width={6} height={6} backgroundColor="primary" flexShrink={0} />
      <PlainText
        fontFamily="mono"
        fontSize={11}
        fontWeight="600"
        letterSpacing={1.6}
        color="dim"
        textTransform="uppercase"
      >
        {children}
      </PlainText>
    </XStack>
  );
}
