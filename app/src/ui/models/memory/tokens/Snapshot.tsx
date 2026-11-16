import { YStack } from 'tamagui';
import { fillOf, outlineOf, type TokenState } from './ink';

// A snapshot (a point the chat can go back to): an instant photo, its
// picture amber, tilted as if dropped on the desk.
export default function Snapshot({ state }: { state: TokenState }) {
  return (
    <YStack width={18} height={21} borderWidth={1.5} borderColor={outlineOf(state)} padding={2} paddingBottom={5} rotate="-5deg">
      <YStack flex={1} backgroundColor={fillOf(state)} />
    </YStack>
  );
}
