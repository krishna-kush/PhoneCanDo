import { Text, XStack, YStack } from 'tamagui';
import { useTheme } from '../common/globals';
import { type A11yStep, stepCopy } from './guide';

// All three steps at once, the current one spelled out: users see where
// they are and what is left (a lone "step 2" read as a dead end).
export default function StepList({ step, note }: { step: A11yStep; note: boolean }) {
  const t = useTheme();
  return (
    <YStack gap="$2">
      {([1, 2, 3] as const).map((n) => {
        const copy = stepCopy(n, note);
        const current = n === step;
        return (
          <XStack key={n} gap="$2" alignItems="flex-start">
            <Text width={22} fontSize={14} fontWeight="700" color={current ? t.primary : t.muted}>
              {n < step ? '✓' : `${n}.`}
            </Text>
            <YStack flex={1} gap="$1">
              <Text fontSize={14} fontWeight={current ? '700' : '400'} color={current ? t.fg : t.muted}>
                {copy.title}
              </Text>
              {current ? (
                <Text fontSize={13} color={t.fg}>
                  {copy.body}
                </Text>
              ) : null}
            </YStack>
          </XStack>
        );
      })}
    </YStack>
  );
}
