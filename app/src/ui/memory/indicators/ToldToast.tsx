import { useEffect } from 'react';
import { XStack, YStack } from 'tamagui';
import { useMemoryStore } from '../../../state/memory';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import { useToldLine } from '../useToldLine';

/** How long the line stays before it goes by itself. */
const SHOWN_MS = 8000;

// After the runner stopped an agent by itself to free memory: a line
// dropping in at the top over whatever is open, saying who went to sleep
// and why, then gone after a few seconds or on a tap. While the RAM
// warning is up, the warning says it instead.
export default function ToldToast() {
  const told = useMemoryStore((s) => s.told);
  const sheetOpen = useMemoryStore((s) => s.sheetOpen);
  const dismissTold = useMemoryStore((s) => s.dismissTold);
  const line = useToldLine();
  const at = told?.at ?? null;

  useEffect(() => {
    if (at == null || sheetOpen) return;
    const id = setTimeout(dismissTold, SHOWN_MS);
    return () => clearTimeout(id);
  }, [at, sheetOpen, dismissTold]);

  if (!line || sheetOpen) return null;
  return (
    <YStack position="absolute" top={8} left={12} right={12} pointerEvents="box-none">
      <XStack
        alignItems="center"
        gap="3"
        padding="3"
        borderWidth={1}
        borderColor="lineStrong"
        backgroundColor="panel"
        boxShadow="2px 2px 0 secondary"
        opacity="press:0.85"
        onPress={dismissTold}
        accessibilityRole="button"
        accessibilityLabel={`${line} Tap to dismiss.`}
        accessibilityLiveRegion="polite"
      >
        <AgentFace mood="asleep" size={22} />
        <YStack flex={1} minWidth={0}>
          <PlainText fontSize={14}>{line}</PlainText>
        </YStack>
      </XStack>
    </YStack>
  );
}
