import { YStack } from 'tamagui';
import { installedVersion } from '../../../engine/updates/manifest';
import { checkNow } from '../../../state/flows/update/check';
import { startDownload, stopDownload } from '../../../state/flows/update/download';
import { useUpdateStore } from '../../../state/update';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import Route from '../../common/route/Route';
import { TWO_STEPS } from '../copy';
import { useDownloadLine } from '../useDownloadLine';
import ParcelLabel from './ParcelLabel';
import { releasePageOf } from '../logic/release';

// Settings → Updates' own view of a newer build, the same trip as the
// update box: waiting at GitHub with its shipping label and Download (the
// download runs right here, the box stays shut), on its way with Stop, or
// in with Install (the box opens on the install step, which says what it
// stops first). Nothing while no newer build is known.
export default function UpdateCard({ lite }: { lite: boolean }) {
  const manifest = useUpdateStore((s) => s.manifest);
  const step = useUpdateStore((s) => s.step);
  if (!manifest || step == null || step === 'none') return null;
  const version = manifest.version;

  if (step === 'downloading') return <Downloading version={version} lite={lite} />;

  if (step === 'offer' || step === 'checking' || step === 'error') {
    return (
      <YStack gap="3" paddingTop="2">
        <PlainText fontSize={17} fontWeight="700">
          {lite ? 'The full build is ready to ship' : `v${version} is out`}
        </PlainText>
        <Route stage="waiting" />
        <ParcelLabel from={installedVersion().version} to={version} size={manifest.size} notes={manifest.notes} releaseUrl={releasePageOf(manifest.apk)} lite={lite} />
        <PlainText fontSize={13} color="dim">
          {TWO_STEPS}
        </PlainText>
        <AppButton onPress={() => void startDownload({ show: false })}>{lite ? 'Download the full build' : `Download v${version}`}</AppButton>
      </YStack>
    );
  }

  // Downloaded, or its install under way or just cancelled.
  return (
    <YStack gap="3" paddingTop="2">
      <PlainText fontSize={17} fontWeight="700">
        {lite ? 'The full build is here' : `v${version} is here`}
      </PlainText>
      <Route stage="done" />
      <PlainText fontSize={14} color="muted">
        Downloaded and checked. Installing stops your agents for a minute; the next step says which first.
      </PlainText>
      <AppButton onPress={() => void checkNow()}>{lite ? 'Install the full build' : `Install v${version}`}</AppButton>
    </YStack>
  );
}

function Downloading({ version, lite }: { version: string; lite: boolean }) {
  const { fraction, line, working, paused } = useDownloadLine();
  return (
    <YStack gap="3" paddingTop="2">
      <PlainText fontSize={17} fontWeight="700">
        {lite ? 'Fetching the full build' : `Downloading v${version}`}
      </PlainText>
      <Route stage={paused ? 'paused' : 'moving'} fraction={fraction} working={working} />
      <PlainText fontFamily="mono" fontSize={12} color="dim">
        {line}
      </PlainText>
      <PlainText fontSize={13} color="dim">
        Your agents keep working. It keeps going if you leave this page or PhoneCanDo closes.
      </PlainText>
      <AppButton variant="secondary" onPress={stopDownload}>
        Stop the download
      </AppButton>
    </YStack>
  );
}
