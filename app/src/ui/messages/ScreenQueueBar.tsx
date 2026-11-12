import { XStack, YStack } from 'tamagui';
import type { ScreenQueue } from '../../engine/messages/types';
import PlainText from '../common/PlainText';
import { screenLine } from './logic/messagesCopy';

// The top of the Messages page while an agent drives the phone's screen or
// waits for it: who holds it and who is in line, in one line. One agent
// drives the screen at a time; the runner hands it to the next in line and
// tells each of them with a notice (below, in the list).
export default function ScreenQueueBar({ queue }: { queue: ScreenQueue }) {
  const line = screenLine(queue);
  if (!line) return null;
  return (
    <XStack
      alignItems="center"
      gap="2"
      borderWidth={1}
      borderColor="secondaryLine"
      backgroundColor="secondarySoft"
      paddingHorizontal="3"
      paddingVertical="2"
      accessibilityRole="text"
      accessibilityLabel={line}
    >
      <YStack width={6} height={6} backgroundColor="secondary" flexShrink={0} />
      <PlainText fontFamily="mono" fontSize={12} color="secondaryInk" flexShrink={1}>
        {line}
      </PlainText>
    </XStack>
  );
}
