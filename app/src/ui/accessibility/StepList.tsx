import { XStack, YStack } from 'tamagui';
import { type A11yStep, stepCopy } from './guide';
import PlainText from '../common/PlainText';

// All three steps at once, the current one spelled out: users see where
// they are and what is left (a lone "step 2" read as a dead end).
export default function StepList({ step, note }: { step: A11yStep; note: boolean }) {
  return (
    <YStack gap="2">
      {([1, 2, 3] as const).map((n) => {
        const copy = stepCopy(n, note);
        const current = n === step;
        return (
          <XStack key={n} gap="2" alignItems="flex-start">
            <PlainText width={22} fontSize={14} fontWeight="700" color={current ? 'primary' : 'muted'}>
              {n < step ? '✓' : `${n}.`}
            </PlainText>
            <YStack flex={1} gap="1">
              <PlainText fontSize={14} fontWeight={current ? '700' : '400'} color={current ? 'fg' : 'muted'}>
                {copy.title}
              </PlainText>
              {current ? (
                <PlainText fontSize={13} color="fg">
                  {copy.body}
                </PlainText>
              ) : null}
            </YStack>
          </XStack>
        );
      })}
    </YStack>
  );
}
