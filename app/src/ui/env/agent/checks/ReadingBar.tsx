import { YStack } from 'tamagui';

// The thin bar while a local model reads the check's task: how much of the
// prompt it has read (0 to 1).
export default function ReadingBar({ progress }: { progress: number }) {
  return (
    <YStack height={3} backgroundColor="line" overflow="hidden" accessibilityRole="progressbar">
      <YStack height={3} width={`${Math.round(progress * 100)}%`} backgroundColor="secondary" />
    </YStack>
  );
}
