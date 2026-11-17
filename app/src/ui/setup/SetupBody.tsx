import { Text, YStack } from 'tamagui';
import AppButton from '../common/AppButton';
import Note from '../env/parts/Note';
import ArcadeScene from './arcade/ArcadeScene';
import type { SceneProps } from './arcade/props';

type Props = {
  title: string;
  note: string | null;
  scene: SceneProps;
  /** Set up stopped: why, Retry, and on the Linux path Continue without Linux. */
  failure?: { text: string; onRetry: () => void; onSkip: (() => void) | null };
};

// What the setup screen shows (FirstLaunchScreen): its title, the arcade
// scene, a note while it works, or why it stopped with Retry and, on the
// Linux path, Continue without Linux.
export default function SetupBody({ title, note, scene, failure }: Props) {
  return (
    <YStack gap="4">
      <Text fontSize={24} fontWeight="700">
        {title}
      </Text>
      <ArcadeScene {...scene} />
      {note && !failure ? <Note>{note}</Note> : null}
      {failure ? (
        <YStack gap="3">
          <Note tone="error">{failure.text}</Note>
          <AppButton onPress={failure.onRetry}>Retry</AppButton>
          {failure.onSkip ? (
            <AppButton variant="secondary" onPress={failure.onSkip}>
              Continue without Linux
            </AppButton>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}
