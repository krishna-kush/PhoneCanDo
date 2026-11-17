import { XStack, YStack } from 'tamagui';
import type { UpdateManifest } from '../../../engine/updates/manifest';
import { closeBox } from '../../../state/flows/update/box';
import { stopDownload } from '../../../state/flows/update/download';
import AppButton from '../../common/AppButton';
import PlainText from '../../common/PlainText';
import Route from '../../common/route/Route';
import { WHILE_DOWNLOADING } from '../copy';
import { useDownloadLine } from '../useDownloadLine';

// The first step under way: the parcel on its way to this phone, how far
// and how long, and that nothing has stopped. Hide leaves it running; the
// box comes back by itself once it is in.
export default function DownloadStep({ manifest, lite }: { manifest: UpdateManifest; lite: boolean }) {
  const { fraction, line, written, total, working, paused } = useDownloadLine();
  return (
    <>
      <PlainText fontSize={19} fontWeight="700">
        {lite ? 'Fetching the full build' : `Downloading v${manifest.version}`}
      </PlainText>
      <Route stage={paused ? 'paused' : 'moving'} fraction={fraction} working={working} />
      <YStack accessibilityRole="progressbar" accessibilityValue={total > 0 ? { min: 0, max: 100, now: Math.floor((written / total) * 100) } : undefined}>
        <PlainText fontFamily="mono" fontSize={12} color="dim">
          {line}
        </PlainText>
      </YStack>
      <PlainText fontSize={13} color="dim">
        {WHILE_DOWNLOADING}
      </PlainText>
      <XStack gap="2" marginTop="2">
        <AppButton variant="secondary" flex={1} onPress={stopDownload}>
          Stop
        </AppButton>
        <AppButton flex={1} onPress={closeBox}>
          Hide
        </AppButton>
      </XStack>
    </>
  );
}
