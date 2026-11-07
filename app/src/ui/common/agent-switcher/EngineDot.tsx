import { YStack } from 'tamagui';
import type { EngineState } from '../../../engine/agents/records';
import { useTheme, type Theme } from '../globals';
import { engineDot, type DotTone } from './engineDot';

const FILL: Record<DotTone, keyof Theme | null> = {
  running: 'fg',
  busy: 'secondary',
  error: 'primary',
  off: null,
};

// Square status dot in the palette's inks: solid ink running, amber
// starting/stopping, red died/failed, hollow stopped. Callers show the word.
export default function EngineDot({ state, size = 8 }: { state: EngineState | undefined; size?: number }) {
  const t = useTheme();
  const fill = FILL[engineDot(state).tone];
  return (
    <YStack
      width={size}
      height={size}
      flexShrink={0}
      backgroundColor={fill ? t[fill] : 'transparent'}
      borderWidth={fill ? 0 : 1}
      borderColor={t.faint}
    />
  );
}
