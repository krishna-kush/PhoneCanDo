import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';

// The license's short version on the gate, a line each, marked with the
// site's small red square (as a section's kicker is).
export default function ShortVersion({ lines }: { lines: readonly string[] }) {
  return (
    <YStack gap="2">
      {lines.map((line) => (
        <XStack key={line} gap="3" alignItems="flex-start">
          <YStack width={6} height={6} marginTop={8} backgroundColor="primary" flexShrink={0} />
          <PlainText fontSize={15} lineHeight="22px" flex={1}>
            {line}
          </PlainText>
        </XStack>
      ))}
    </YStack>
  );
}
