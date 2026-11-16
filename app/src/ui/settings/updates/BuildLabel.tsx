import { XStack, YStack } from 'tamagui';
import FieldLine from '../../common/FieldLine';
import PlainText from '../../common/PlainText';
import Plate from '../../common/Plate';
import KeyBarcode from '../../common/rows/barcode/KeyBarcode';
import { ROW_GUTTER } from '../../common/rows/place';
import Stamp from '../../common/Stamp';
import { type Channel, labelFields, labelStamp, tapeWord } from './copy';

type Props = { channel: Channel; version: string; versionCode: number };

// The build on this phone as a parcel's shipping label, on the site's hard
// amber shadow: red tape across its top, the version big where an address
// goes, its build, channel and contents, a faint barcode, and a stamp
// that slams on as the page opens (Delivered, Starter, Play keeps it).
export default function BuildLabel({ channel, version, versionCode }: Props) {
  return (
    <Plate>
      <XStack justifyContent="space-between" gap="3" paddingHorizontal={ROW_GUTTER} paddingVertical={8} backgroundColor="primary">
        <PlainText fontFamily="mono" fontSize={10} fontWeight="600" letterSpacing={1.6} textTransform="uppercase" color="onPrimary">
          PhoneCanDo
        </PlainText>
        <PlainText fontFamily="mono" fontSize={10} fontWeight="600" letterSpacing={1.6} textTransform="uppercase" color="onPrimary">
          {tapeWord(channel)}
        </PlainText>
      </XStack>
      <YStack padding={ROW_GUTTER} gap={8}>
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint">
          On this phone
        </PlainText>
        <PlainText fontSize={28} fontWeight="700" letterSpacing={-0.4}>
          {`v${version}`}
        </PlainText>
        {labelFields(channel, versionCode).map((f) => (
          <FieldLine key={f.term} term={f.term} value={f.value} lines={2} />
        ))}
        <YStack paddingTop="2">
          <KeyBarcode barcode="buildLabel" />
        </YStack>
      </YStack>
      <YStack position="absolute" top={52} right={14} pointerEvents="none">
        <Stamp slam tone={channel === 'full' ? 'primary' : 'secondary'}>
          {labelStamp(channel)}
        </Stamp>
      </YStack>
    </Plate>
  );
}
