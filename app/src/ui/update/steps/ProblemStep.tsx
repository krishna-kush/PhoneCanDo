import { XStack } from 'tamagui';
import { openInstallSettings } from '../../../engine/updates/install';
import { closeBox } from '../../../state/flows/update/box';
import { checkNow } from '../../../state/flows/update/check';
import { startDownload } from '../../../state/flows/update/download';
import { install } from '../../../state/flows/update/install';
import type { UpdateStage } from '../../../state/logic/update/steps';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';

const TITLE: Record<UpdateStage, string> = {
  check: 'Check failed',
  download: 'Download failed',
  install: 'Install failed',
};

const RETRY: Record<UpdateStage, () => void> = {
  check: () => void checkNow(),
  download: () => void startDownload(),
  install: () => void install(),
};

// A step that failed, what went wrong, and Retry for that same step.
export default function ProblemStep({ stage, message }: { stage: UpdateStage; message: string }) {
  return (
    <>
      <PlainText fontSize={19} fontWeight="700">
        {TITLE[stage]}
      </PlainText>
      <PlainText fontSize={15} color="muted">
        {message}
      </PlainText>
      {stage === 'install' && !__DEV__ ? (
        <AppButton variant="secondary" onPress={() => void openInstallSettings()}>
          Open install settings
        </AppButton>
      ) : null}
      <XStack gap="2" marginTop="2">
        <AppButton variant="secondary" flex={1} onPress={closeBox}>
          Close
        </AppButton>
        <AppButton flex={1} onPress={RETRY[stage]}>
          Retry
        </AppButton>
      </XStack>
    </>
  );
}
