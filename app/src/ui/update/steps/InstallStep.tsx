import { XStack, YStack } from 'tamagui';
import type { UpdateManifest } from '../../../engine/updates/manifest';
import { closeBox } from '../../../state/flows/update/box';
import { install } from '../../../state/flows/update/install';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import Stamp from '../../common/Stamp';
import Route from '../../common/route/Route';
import StopList from '../stops/StopList';

// The second step, on its own tap: the parcel is in (A-01 pleased at the
// door, the stamp landing), and before Install the box says what it will
// stop, read live. Later keeps the download for Settings → Updates or the
// next launch.
export default function InstallStep({ manifest, lite }: { manifest: UpdateManifest; lite: boolean }) {
  return (
    <>
      <YStack position="absolute" top={4} right={0} pointerEvents="none" zIndex={1}>
        <Stamp slam>Delivered</Stamp>
      </YStack>
      <PlainText fontSize={19} fontWeight="700">
        {lite ? 'The full build is here' : `v${manifest.version} is here`}
      </PlainText>
      <Route stage="done" />
      <PlainText fontSize={14} color="muted">
        Downloaded and checked. Install when it suits you: it waits here and in Settings → Updates.
      </PlainText>
      <StopList />
      <XStack gap="2" marginTop="2">
        <AppButton variant="secondary" flex={1} onPress={closeBox}>
          Later
        </AppButton>
        <AppButton flex={1} onPress={() => void install()}>
          {lite ? 'Install it' : 'Install now'}
        </AppButton>
      </XStack>
    </>
  );
}
