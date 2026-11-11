import { Text, XStack, YStack } from 'tamagui';
import { useTheme } from '../../common/globals';
import { SAFETY_LINES } from '../logic/customAgentText';

// What we say plainly before a custom agent is saved or imported: the
// machine is no sandbox, the script runs as root with network, and someone
// else's agent is someone else's code. A hairline box in the error ink.
export default function SafetyNotes() {
  const t = useTheme();
  return (
    <YStack borderWidth={1} borderColor={t.primary} padding="3" gap="2" accessibilityRole="summary">
      {SAFETY_LINES.map((line) => (
        <XStack key={line} gap="2">
          <Text fontSize={14} color={t.primary}>
            !
          </Text>
          <Text fontSize={14} color={t.fg} flex={1}>
            {line}
          </Text>
        </XStack>
      ))}
    </YStack>
  );
}
