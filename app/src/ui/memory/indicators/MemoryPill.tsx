import { XStack, YStack } from 'tamagui';
import type { MemoryLevel } from '../../../engine/memory';
import { useAppStore } from '../../../state/app';
import { useKeyboardStore } from '../../../state/keyboard';
import { useMemoryStore } from '../../../state/memory';
import ChevronIcon from '../../common/ChevronIcon';
import AgentFace from '../../common/face/AgentFace';
import { useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { pillLabel, pillText } from '../logic/memoryCopy';
import { useCountdown } from '../useCountdown';

// While memory is short and the RAM warning is closed, on a page with no
// bar of its own: a pill floating at the foot of the page with A-01
// sweating and the countdown; a tap opens the warning again. Home and a
// terminal page carry the bar chip instead (MemoryChip.tsx). Pages keep
// room at their foot (Screen's FAB clearance), so it hides nothing for
// good; it steps aside while the keyboard is up or the drawer is open.
export default function MemoryPill() {
  const level = useMemoryStore((s) => s.status.level);
  const stopAt = useMemoryStore((s) => s.status.stopAt);
  const sheetOpen = useMemoryStore((s) => s.sheetOpen);
  const top = useAppStore((s) => s.pages[s.pages.length - 1]?.route.name ?? null);
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const typing = useKeyboardStore((s) => s.open);
  if (level === 'ok' || sheetOpen || top == null || top === 'terminal' || drawerOpen || typing) return null;
  return <Pill level={level} stopAt={stopAt} />;
}

function Pill({ level, stopAt }: { level: MemoryLevel; stopAt: number | null }) {
  const t = useTheme();
  const openSheet = useMemoryStore((s) => s.openSheet);
  const seconds = useCountdown(stopAt);
  const critical = level === 'critical';
  return (
    <YStack position="absolute" left={0} right={0} bottom={16} alignItems="center" pointerEvents="box-none">
      <XStack
        alignItems="center"
        gap="2"
        minHeight={40}
        paddingHorizontal="3"
        borderWidth={1}
        borderColor={critical ? 'primary' : 'secondaryLine'}
        backgroundColor="panel"
        boxShadow="2px 2px 0 secondary"
        opacity="press:0.85"
        onPress={openSheet}
        accessibilityRole="button"
        accessibilityLabel={pillLabel(level, seconds)}
      >
        <AgentFace mood="sweaty" size={16} />
        <PlainText
          fontFamily="mono"
          fontSize={12}
          letterSpacing={1}
          textTransform="uppercase"
          color={critical ? 'primary' : 'secondaryInk'}
          numberOfLines={1}
        >
          {pillText(level, seconds)}
        </PlainText>
        <ChevronIcon size={12} color={t.dim} />
      </XStack>
    </YStack>
  );
}
