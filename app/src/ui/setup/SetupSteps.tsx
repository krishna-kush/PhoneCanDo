import { Text, XStack, YStack } from 'tamagui';
import { useTheme } from '../common/globals';
import { SETUP_PHASES } from '../env/logic/steps';

// The three setup phases in plain words: done ones ticked, the current one
// marked, the rest faint.
export default function SetupSteps({ current, allDone }: { current: number; allDone: boolean }) {
  const t = useTheme();
  return (
    <YStack gap="2">
      {SETUP_PHASES.map((label, i) => {
        const done = allDone || i < current;
        const now = !allDone && i === current;
        return (
          <XStack key={label} alignItems="center" gap="3">
            <Text
              fontFamily="mono"
              fontSize={14}
              width={16}
              textAlign="center"
              color={done ? t.secondaryInk : now ? t.primary : t.faint}
            >
              {done ? '✓' : now ? '●' : '○'}
            </Text>
            <Text fontSize={16} color={done || now ? t.fg : t.dim} fontWeight={now ? '600' : '400'}>
              {label}
            </Text>
          </XStack>
        );
      })}
    </YStack>
  );
}
