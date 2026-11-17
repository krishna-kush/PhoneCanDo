import { XStack } from 'tamagui';
import { installedVersion } from '../../../engine/updates/manifest';
import { closeBox } from '../../../state/flows/update/box';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';

// Settings' check found nothing newer.
export default function NoneStep() {
  return (
    <>
      <PlainText fontSize={19} fontWeight="700">
        Up to date
      </PlainText>
      <PlainText fontSize={15} color="muted">
        PhoneCanDo {installedVersion().version} is the latest release.
      </PlainText>
      <XStack gap="2" marginTop="2">
        <AppButton flex={1} onPress={closeBox}>
          Close
        </AppButton>
      </XStack>
    </>
  );
}
