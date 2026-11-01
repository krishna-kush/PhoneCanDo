import { Text, XStack, YStack } from 'tamagui';
import { useTheme } from './globals';

// The site's `.kicker`: a red square + mono uppercase micro-label. Replaces
// the bold amber sans heading, which read like a stock settings app.
export default function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return (
    <XStack alignItems="center" gap="$2" marginTop="$3">
      <YStack width={6} height={6} backgroundColor={t.primary} flexShrink={0} />
      <Text
        fontFamily="$mono"
        fontSize={11}
        fontWeight="600"
        letterSpacing={1.6}
        color={t.dim}
        textTransform="uppercase"
      >
        {children}
      </Text>
    </XStack>
  );
}
