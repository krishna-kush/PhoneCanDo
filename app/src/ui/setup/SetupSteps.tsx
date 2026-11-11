import { XStack, YStack } from 'tamagui';
import { SETUP_PHASES } from '../env/logic/steps';
import PlainText from '../common/PlainText';

// The three setup phases in plain words: done ones ticked, the current one
// marked, the rest faint.
export default function SetupSteps({ current, allDone }: { current: number; allDone: boolean }) {
  return (
    <YStack gap="2">
      {SETUP_PHASES.map((label, i) => {
        const done = allDone || i < current;
        const now = !allDone && i === current;
        return (
          <XStack key={label} alignItems="center" gap="3">
            <PlainText
              fontFamily="mono"
              fontSize={14}
              width={16}
              textAlign="center"
              color={done ? 'secondaryInk' : now ? 'primary' : 'faint'}
            >
              {done ? '✓' : now ? '●' : '○'}
            </PlainText>
            <PlainText fontSize={16} color={done || now ? 'fg' : 'dim'} fontWeight={now ? '600' : '400'}>
              {label}
            </PlainText>
          </XStack>
        );
      })}
    </YStack>
  );
}
