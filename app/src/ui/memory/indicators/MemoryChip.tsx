import { XStack } from 'tamagui';
import type { MemoryLevel } from '../../../engine/memory';
import { useMemoryStore } from '../../../state/memory';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import { pillLabel, pillText } from '../logic/memoryCopy';
import { useCountdown } from '../useCountdown';

// In a bar (Home's, a terminal page's) while memory is short and the RAM
// warning is closed: A-01 sweating beside the countdown, one short line
// like the reading chip, so the bar never changes height. A tap opens the
// warning again.
export default function MemoryChip() {
  const level = useMemoryStore((s) => s.status.level);
  const stopAt = useMemoryStore((s) => s.status.stopAt);
  const sheetOpen = useMemoryStore((s) => s.sheetOpen);
  if (level === 'ok' || sheetOpen) return null;
  return <Chip level={level} stopAt={stopAt} />;
}

function Chip({ level, stopAt }: { level: MemoryLevel; stopAt: number | null }) {
  const openSheet = useMemoryStore((s) => s.openSheet);
  const seconds = useCountdown(stopAt);
  const critical = level === 'critical';
  return (
    <XStack
      flexShrink={0}
      alignItems="center"
      gap={4}
      borderWidth={1}
      borderColor={critical ? 'primary' : 'secondaryLine'}
      backgroundColor={critical ? 'primarySoft' : 'secondarySoft'}
      paddingHorizontal={6}
      paddingVertical={2}
      opacity="press:0.7"
      hitSlop={12}
      onPress={openSheet}
      accessibilityRole="button"
      accessibilityLabel={pillLabel(level, seconds)}
    >
      <AgentFace mood="sweaty" size={11} />
      <PlainText fontFamily="mono" fontSize={12} color={critical ? 'primary' : 'secondaryInk'} numberOfLines={1}>
        {pillText(level, seconds)}
      </PlainText>
    </XStack>
  );
}
