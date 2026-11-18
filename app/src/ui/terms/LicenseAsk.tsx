import { useState } from 'react';
import { BackHandler } from 'react-native';
import { XStack } from 'tamagui';
import { useAppStore } from '../../state/app';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import BottomSheet from '../common/sheet/BottomSheet';
import SheetScroll from '../common/sheet/SheetScroll';
import { AGREE, askKicker, askTitle, changedLine, READ, wholeLicenseLine } from './copy';
import LicenseTextView from './LicenseTextView';
import { LICENSE_TEXT, LICENSE_VERSION } from './licenseText';
import { isReAsk } from './logic/agreement';
import { licenseTitle } from './logic/blocks';
import ShortVersion from './parts/ShortVersion';
import { SHORT_VERSION } from './summary';
import { useLicenseAsk } from './useLicenseAsk';

const agree = () => void useAppStore.getState().agreeToLicense(LICENSE_VERSION);

// The license asking on its own, a sheet over Home: for installs from
// before we asked, and once more after each new license version. First
// launch never sees it: the first shift's hello asks at the end of
// onboarding (starter/HelloSheet.tsx). Only I agree closes it; Back leaves
// the app and the sheet is there on return. Nothing is sent.
export default function LicenseAsk() {
  const open = useLicenseAsk();
  // Read once: it keeps its words while it slides away after I agree.
  const [reAsk] = useState(() => isReAsk(useAppStore.getState().licenseAgreed?.version ?? null, LICENSE_VERSION));
  const [reading, setReading] = useState(false);

  return (
    <>
      <BottomSheet open={open} onClose={() => {}} locked onBlocked={() => BackHandler.exitApp()}>
        <SheetScroll contentContainerStyle={{ padding: 16, gap: 12 }}>
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
            {askKicker(LICENSE_VERSION)}
          </PlainText>
          <PlainText fontSize={19} fontWeight="700">
            {askTitle(reAsk)}
          </PlainText>
          <ShortVersion lines={SHORT_VERSION} />
          <PlainText fontSize={13} color="dim">
            {wholeLicenseLine(licenseTitle(LICENSE_TEXT))}
          </PlainText>
          {reAsk ? (
            <PlainText fontSize={14} fontWeight="600" color="secondaryInk">
              {changedLine(LICENSE_VERSION)}
            </PlainText>
          ) : null}
          <XStack gap="2" justifyContent="flex-end" flexWrap="wrap">
            <AppButton variant="ghost" onPress={() => setReading(true)}>
              {READ}
            </AppButton>
            <AppButton onPress={agree}>{AGREE}</AppButton>
          </XStack>
        </SheetScroll>
      </BottomSheet>
      <LicenseTextView open={open && reading} onClose={() => setReading(false)} />
    </>
  );
}
