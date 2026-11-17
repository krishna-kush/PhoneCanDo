import { XStack } from 'tamagui';
import { openInstallSettings } from '../../../engine/updates/install';
import { closeBox } from '../../../state/flows/update/box';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';

// Android's "Install unknown apps" is off for PhoneCanDo: the way to it.
// Nothing has stopped yet; back with it on, the install carries on by
// itself (UpdateBox listens).
export default function PermissionStep() {
  return (
    <>
      <PlainText fontSize={19} fontWeight="700">
        One quick OK from Android
      </PlainText>
      <PlainText fontSize={15} color="muted">
        Android asks before any app installs something, even its own update. Tap Open settings,
        switch on "Allow from this source" for PhoneCanDo, then come back. The install carries on by
        itself.
      </PlainText>
      <XStack gap="2" marginTop="2">
        <AppButton variant="secondary" flex={1} onPress={closeBox}>
          Later
        </AppButton>
        <AppButton flex={1} onPress={() => void openInstallSettings()}>
          Open settings
        </AppButton>
      </XStack>
    </>
  );
}
