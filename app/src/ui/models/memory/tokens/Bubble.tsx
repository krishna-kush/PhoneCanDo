import { YStack } from 'tamagui';
import { fillOf, outlineOf, type TokenState } from './ink';

// A saved chat: a square speech bubble with two lines of words and a pixel
// tail, as A-01's pixel heart is drawn.
export default function Bubble({ state }: { state: TokenState }) {
  const ink = outlineOf(state);
  return (
    <YStack alignItems="flex-start">
      <YStack width={22} height={16} borderWidth={1.5} borderColor={ink} paddingHorizontal={3} justifyContent="center" gap={2}>
        <YStack width={12} height={2} backgroundColor={fillOf(state)} />
        <YStack width={8} height={2} backgroundColor={fillOf(state)} />
      </YStack>
      <YStack marginLeft={4} width={4} height={3} backgroundColor={ink} />
      <YStack marginLeft={4} width={2} height={2} backgroundColor={ink} />
    </YStack>
  );
}
