import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import FieldLine from '../../common/FieldLine';
import BoopFace from '../../common/face/BoopFace';
import PlainText from '../../common/PlainText';
import Plate from '../../common/Plate';
import KeyHead from '../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../common/rows/place';
import Stamp from '../../common/Stamp';
import { usePageActive } from '../../nav/pageActive';
import Barcode from '../Barcode';
import { boopCaption, isJackpot, JACKPOT_EVERY, plateFields } from './copy';
import PostcardFlip from './postcard/PostcardFlip';

// How long a jackpot's hearts float.
const PARTY_MS = 4000;

type Props = { version: string; versionCode: number; channel: string };

// The app's spec plate, as a printed plate on the site's hard amber
// shadow: its figure strip, A-01 beside the facts (version, build,
// channel, boops so far), what A-01 says, and the version as a real
// barcode. Tap A-01: it hops and counts; every tenth boop is a jackpot,
// hearts float and a stamp slams onto the plate. Its back is a postcard
// from us: swipe the plate sideways, or tap its folded corner
// (postcard/).
export default function SpecPlate({ version, versionCode, channel }: Props) {
  const active = usePageActive();
  const [boops, setBoops] = useState(0);
  const [party, setParty] = useState(false);

  useEffect(() => {
    if (!isJackpot(boops)) return;
    setParty(true);
    const timer = setTimeout(() => setParty(false), PARTY_MS);
    return () => clearTimeout(timer);
  }, [boops]);

  return (
    <PostcardFlip>
      <Plate>
        <KeyHead title="Spec plate · fig. 00" barcode="specPlate" />
        <XStack padding={ROW_GUTTER} gap="4" alignItems="center">
          <BoopFace mood={party ? 'happy' : 'awake'} hearts={3} size={56} still={!active} label="A-01, the mascot. Tap it." onBoop={setBoops} />
          <YStack flex={1} minWidth={0} gap={6}>
            {plateFields(version, versionCode, channel, boops).map((f) => (
              <FieldLine key={f.term} term={f.term} value={f.value} lines={2} />
            ))}
          </YStack>
        </XStack>
        <YStack paddingHorizontal={ROW_GUTTER}>
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="secondaryInk" textTransform="uppercase">
            {`A-01 · ${boopCaption(boops)}`}
          </PlainText>
        </YStack>
        <YStack padding={ROW_GUTTER}>
          <Barcode text={`PCD ${version}`} module={1.5} height={40} />
        </YStack>
        {party ? (
          <YStack position="absolute" top={48} right={12} pointerEvents="none">
            <Stamp key={boops} slam>
              {boops === JACKPOT_EVERY ? 'Best friends' : `${boops} boops`}
            </Stamp>
          </YStack>
        ) : null}
      </Plate>
    </PostcardFlip>
  );
}
