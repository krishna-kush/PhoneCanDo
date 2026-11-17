import { XStack } from 'tamagui';
import { closeBox } from '../../../state/flows/update/box';
import { install } from '../../../state/flows/update/install';
import { useUpdateStore } from '../../../state/update';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import { CANCELLED, INSTALLER, STOPPING } from '../copy';
import FaceRow from '../stops/FaceRow';

// The install under way: the agents it stopped fall asleep one by one,
// then Android's installer is up (no way out of the box but its answer).
// Back here without an install, they wake up again, and Try again is one
// tap.
export default function StopStep({ step }: { step: 'stopping' | 'installer' | 'cancelled' }) {
  const stopped = useUpdateStore((s) => s.stopped);
  const copy = step === 'stopping' ? STOPPING : step === 'installer' ? INSTALLER : CANCELLED;
  return (
    <>
      <PlainText fontSize={19} fontWeight="700">
        {copy.title}
      </PlainText>
      <PlainText fontSize={15} color="muted">
        {copy.body}
      </PlainText>
      <FaceRow ids={stopped} />
      {step === 'cancelled' ? (
        <XStack gap="2" marginTop="2">
          <AppButton variant="secondary" flex={1} onPress={closeBox}>
            Later
          </AppButton>
          <AppButton flex={1} onPress={() => void install()}>
            Try again
          </AppButton>
        </XStack>
      ) : null}
    </>
  );
}
