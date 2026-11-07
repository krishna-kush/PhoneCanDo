import { Text, YStack } from 'tamagui';
import AppButton from '../common/AppButton';
import LogoLoader from '../common/LogoLoader';
import LogoMark from '../common/LogoMark';
import Screen from '../common/Screen';
import { stepLabel } from '../env/logic/steps';
import Note from '../env/parts/Note';
import ProgressBar from '../env/parts/ProgressBar';
import { setupNote, setupTitle } from './copy';
import SetupSteps from './SetupSteps';
import { useFirstLaunch } from './useFirstLaunch';
import { useSetupProgress } from './useSetupProgress';

// Shown by App while no agent exists: makes the first agent and its machine
// (Default env, offline, about half a minute), or the Android path where
// Linux is unavailable. A failure says why, with Retry and, on the Linux
// path, Continue without Linux.
export default function FirstLaunchScreen() {
  const { ctx, imageId, phase, retry, skipLinux } = useFirstLaunch();
  const progress = useSetupProgress(imageId);

  const linux = ctx.path === 'linux';
  const failed = phase.kind === 'failed';
  const note = setupNote(ctx);
  const where = progress.failedStep ? `Setup stopped while ${stepLabel(progress.failedStep).toLowerCase()}. ` : '';

  return (
    <Screen fabClearance={false}>
      <YStack flex={1} justifyContent="center" gap="$4" paddingVertical="$6">
        {failed ? <LogoMark size={18} /> : <LogoLoader size={18} />}
        <Text fontSize={24} fontWeight="700">
          {setupTitle(ctx)}
        </Text>
        {note && !failed ? <Note>{note}</Note> : null}
        {linux ? (
          <>
            <SetupSteps current={progress.phase} allDone={progress.imageReady} />
            {!failed ? <ProgressBar label={progress.label} fraction={progress.fraction} /> : null}
          </>
        ) : !failed ? (
          <ProgressBar label="Getting ready" fraction={null} />
        ) : null}
        {phase.kind === 'failed' ? (
          <YStack gap="$3">
            <Note tone="error">{`${where}${phase.reason}`}</Note>
            <AppButton onPress={retry}>Retry</AppButton>
            {linux ? (
              <AppButton variant="secondary" onPress={skipLinux}>
                Continue without Linux
              </AppButton>
            ) : null}
          </YStack>
        ) : null}
      </YStack>
    </Screen>
  );
}
