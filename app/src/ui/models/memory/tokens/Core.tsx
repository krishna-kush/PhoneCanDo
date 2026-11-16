import { XStack, YStack } from 'tamagui';
import { fillOf, outlineOf, type TokenState } from './ink';

function Pins({ ink }: { ink: ReturnType<typeof outlineOf> }) {
  return (
    <XStack gap={3}>
      {[0, 1, 2].map((pin) => (
        <YStack key={pin} width={2} height={3} backgroundColor={ink} />
      ))}
    </XStack>
  );
}

// A CPU thread: a core as a chip, pins above and below, its die amber.
export default function Core({ state }: { state: TokenState }) {
  const ink = outlineOf(state);
  return (
    <YStack alignItems="center">
      <Pins ink={ink} />
      <YStack width={18} height={16} borderWidth={1.5} borderColor={ink} padding={3}>
        <YStack flex={1} backgroundColor={fillOf(state)} />
      </YStack>
      <Pins ink={ink} />
    </YStack>
  );
}
