import { XStack } from 'tamagui';
import type { UpdateManifest } from '../../../engine/updates/manifest';
import { installedVersion } from '../../../engine/updates/manifest';
import { closeBox } from '../../../state/flows/update/box';
import { startDownload } from '../../../state/flows/update/download';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import { TWO_STEPS, WHERE_IT_WAITS } from '../copy';
import Route from '../../common/route/Route';
import ParcelLabel from '../parts/ParcelLabel';
import { releasePageOf } from '../logic/release';

type Props = { manifest: UpdateManifest | null; lite: boolean };

// The first step's offer, where the parcel's trip starts: A-01 waits at
// GitHub's depot with it, and its shipping label says what it is (your
// build to the new one, or lite's trade up to the full build), its weight
// and what's new. Download stops nothing. Checking until GitHub answers.
export default function OfferStep({ manifest, lite }: Props) {
  const current = installedVersion();
  return (
    <>
      <PlainText fontSize={19} fontWeight="700">
        {lite ? 'Give it hands' : manifest ? 'A fresh build is out' : 'Checking for updates'}
      </PlainText>
      <PlainText fontSize={14} color="muted">
        {lite
          ? 'This starter build is a brain in a jar: it chats and runs a terminal, but it cannot touch your phone. The full build adds eyes and hands behind your fingerprint, and installs over this one with nothing lost.'
          : manifest
            ? 'A-01 has it packed at GitHub and is waiting for your word.'
            : `Asking GitHub for anything newer than ${current.version}…`}
      </PlainText>
      <Route stage="waiting" />
      {manifest ? <ParcelLabel from={current.version} to={manifest.version} size={manifest.size} notes={manifest.notes} releaseUrl={releasePageOf(manifest.apk)} lite={lite} /> : null}
      {manifest ? (
        <PlainText fontSize={13} color="dim">
          {lite ? `${TWO_STEPS} Android asks once to allow installs from PhoneCanDo. ${WHERE_IT_WAITS}` : `${TWO_STEPS} ${WHERE_IT_WAITS}`}
        </PlainText>
      ) : null}
      <XStack gap="2" marginTop="2">
        <AppButton variant="secondary" flex={1} onPress={closeBox}>
          Later
        </AppButton>
        <AppButton flex={1} loading={!manifest} onPress={() => void startDownload()}>
          {manifest ? 'Download' : 'Checking'}
        </AppButton>
      </XStack>
    </>
  );
}
