import { XStack, YStack } from 'tamagui';
import { SAFETY_LINES } from '../logic/customAgentText';
import PlainText from '../../common/PlainText';

// What we say plainly before a custom agent is saved or imported: the
// machine is no sandbox, the script runs as root with network, and someone
// else's agent is someone else's code. A hairline box in the error ink.
export default function SafetyNotes() {
  return (
    <YStack borderWidth={1} borderColor="primary" padding="3" gap="2" accessibilityRole="summary">
      {SAFETY_LINES.map((line) => (
        <XStack key={line} gap="2">
          <PlainText fontSize={14} color="primary">
            !
          </PlainText>
          <PlainText fontSize={14} color="fg" flex={1}>
            {line}
          </PlainText>
        </XStack>
      ))}
    </YStack>
  );
}
