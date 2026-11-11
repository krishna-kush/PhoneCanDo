import { useState } from 'react';
import { YStack } from 'tamagui';
import type { Image } from '../../../engine/linux/types';
import { retryImageSetup } from '../../../state/flows/rowActions';
import { useTargetProgress } from '../../../state/linux';
import AppButton from '../../common/AppButton';
import { linuxFailureText, recordErrorText } from '../logic/errorText';
import { progressLine, setupFraction, stepFraction, stepLabel } from '../logic/steps';
import Note from './Note';
import ProgressBar from './ProgressBar';

const BUSY_WORDS: Partial<Record<Image['state'], string>> = {
  creating: 'Setting up',
  resetting: 'Resetting',
  deleting: 'Deleting',
};

// A machine's setup state where it matters: progress while a job runs, the
// failed step with Retry, nothing once it is ready. Shared by the systems list
// rows and the agent page.
export default function ImageStatus({ image }: { image: Image }) {
  const progress = useTargetProgress({ kind: 'image', id: image.id });
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const busyWord = BUSY_WORDS[image.state];
  if (busyWord) {
    const fraction = !progress
      ? null
      : image.state === 'creating'
        ? setupFraction(progress.step, progress.done, progress.total)
        : stepFraction(progress.step, progress.done, progress.total);
    return (
      <ProgressBar
        label={progress ? progressLine(progress.step, progress.done, progress.total) : busyWord}
        fraction={fraction}
      />
    );
  }
  if (image.state !== 'failed') return null;

  const where = image.failedStep ? ` while ${stepLabel(image.failedStep).toLowerCase()}` : '';
  const why = recordErrorText(image);
  return (
    <YStack gap="2">
      <Note tone="error">{`Setup stopped${where}.${why ? ` ${why}` : ''}`}</Note>
      {retryError ? <Note tone="error">{retryError}</Note> : null}
      <AppButton
        variant="secondary"
        loading={retrying}
        onPress={() => {
          setRetrying(true);
          setRetryError(null);
          retryImageSetup(image.id)
            .catch((e: unknown) => setRetryError(linuxFailureText(e)))
            .finally(() => setRetrying(false));
        }}
      >
        Retry
      </AppButton>
    </YStack>
  );
}
