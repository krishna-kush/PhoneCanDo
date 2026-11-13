import { XStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import { readingLabel, readingText } from '../logic/modelText';
import { usePromptReading } from '../usePromptReading';
import PlainText from '../../common/PlainText';

// In the app bar while the agent's local model reads a prompt (the first
// reply on a phone CPU waits minutes for it): one short line beside the
// title, so neither the bar nor the Home view under it changes height; the
// title gives way, and past the title's least width this line shortens
// with an ellipsis, so it never pushes the ⋮ menu off-screen beside the
// messages and RAM chips.
export default function ReadingChip({ agentId }: { agentId: AgentId | null }) {
  const reading = usePromptReading(agentId);
  if (!reading) return null;
  return (
    <XStack
      flexShrink={1}
      minWidth={0}
      borderWidth={1}
      borderColor="secondaryLine"
      paddingHorizontal={6}
      paddingVertical={2}
      accessibilityRole="text"
      accessibilityLabel={readingLabel(reading.read, reading.total)}
      accessibilityLiveRegion="polite"
    >
      <PlainText fontFamily="mono" fontSize={12} color="secondaryInk" numberOfLines={1} flexShrink={1}>
        {readingText(reading.read, reading.total)}
      </PlainText>
    </XStack>
  );
}
