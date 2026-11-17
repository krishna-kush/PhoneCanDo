import { XStack, YStack } from 'tamagui';
import FieldLine from '../../common/FieldLine';
import PlainText from '../../common/PlainText';
import Plate from '../../common/Plate';
import KeyBarcode from '../../common/rows/barcode/KeyBarcode';
import { ROW_GUTTER } from '../../common/rows/place';
import Stamp from '../../common/Stamp';
import { formatBytes } from '../../env/logic/format';
import ReleaseLink from './ReleaseLink';

type Props = {
  /** The build on this phone. */
  from: string;
  /** The newer build. */
  to: string;
  size?: number;
  notes?: string;
  /** Its release page on GitHub, its full notes (logic/release.ts); null for none. */
  releaseUrl?: string | null;
  /** Lite's offer: the full build, with what it adds. */
  lite: boolean;
};

// The newer build as a parcel's shipping label, the twin of the one
// Settings → Updates prints for the build on this phone: red tape across
// its top, the versions big where an address goes, its weight and route,
// what's new (and the link to its full notes on GitHub), a faint barcode,
// and an amber stamp that slams on: ready to ship.
export default function ParcelLabel({ from, to, size, notes, releaseUrl, lite }: Props) {
  return (
    <Plate>
      <XStack justifyContent="space-between" gap="3" paddingHorizontal={ROW_GUTTER} paddingVertical={8} backgroundColor="primary">
        <PlainText fontFamily="mono" fontSize={10} fontWeight="600" letterSpacing={1.6} textTransform="uppercase" color="onPrimary">
          PhoneCanDo
        </PlainText>
        <PlainText fontFamily="mono" fontSize={10} fontWeight="600" letterSpacing={1.6} textTransform="uppercase" color="onPrimary">
          {lite ? 'Full build' : 'Update'}
        </PlainText>
      </XStack>
      <YStack padding={ROW_GUTTER} gap={8}>
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint">
          {lite ? 'Trade up to' : 'Your build → the new one'}
        </PlainText>
        <PlainText fontSize={24} fontWeight="700" letterSpacing={-0.4}>
          {lite ? `v${to}` : `v${from} → v${to}`}
        </PlainText>
        <FieldLine term="Weight" value={size ? formatBytes(size) : '—'} />
        <FieldLine term="From" value="GitHub" />
        <FieldLine term="To" value="this phone" />
        {lite ? <FieldLine term="Adds" value="eyes and hands" /> : null}
        {notes || releaseUrl ? (
          <YStack gap="1" paddingTop="1">
            <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint">
              What's new
            </PlainText>
            {notes ? (
              <PlainText fontSize={14} color="muted">
                {notes}
              </PlainText>
            ) : null}
            {releaseUrl ? <ReleaseLink url={releaseUrl} /> : null}
          </YStack>
        ) : null}
        <YStack paddingTop="2">
          <KeyBarcode barcode="parcelLabel" />
        </YStack>
      </YStack>
      <YStack position="absolute" top={52} right={14} pointerEvents="none">
        <Stamp slam tone="secondary">
          Ready to ship
        </Stamp>
      </YStack>
    </Plate>
  );
}
