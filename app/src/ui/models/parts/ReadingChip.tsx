import { Text, XStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import { useTheme } from '../../common/globals';
import { readingLabel, readingText } from '../logic/modelText';
import { usePromptReading } from '../usePromptReading';

// In the app bar while the agent's local model reads a prompt (the first
// reply on a phone CPU waits minutes for it): one short line beside the
// title, so neither the bar nor the Home view under it changes height; the
// title gives way.
export default function ReadingChip({ agentId }: { agentId: AgentId | null }) {
  const t = useTheme();
  const reading = usePromptReading(agentId);
  if (!reading) return null;
  return (
    <XStack
      flexShrink={0}
      borderWidth={1}
      borderColor={t.secondaryLine}
      paddingHorizontal={6}
      paddingVertical={2}
      accessibilityRole="text"
      accessibilityLabel={readingLabel(reading.read)}
      accessibilityLiveRegion="polite"
    >
      <Text fontFamily="$mono" fontSize={12} color={t.secondaryInk} numberOfLines={1}>
        {readingText(reading.read)}
      </Text>
    </XStack>
  );
}
