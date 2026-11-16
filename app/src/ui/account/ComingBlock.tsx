import { XStack, YStack } from 'tamagui';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import Stamp from '../common/Stamp';
import Note from '../env/parts/Note';
import { COMING, COMING_LINE, COMING_TITLE } from './copy';
import { COMING_STAMP } from './logic/pass';

// What sign-in is for next, as a key box: why first, then each feature
// that will need an account and stay optional, a small "soon" stamp on
// each. Shown signed in or out.
export default function ComingBlock() {
  return (
    <RowGroup title={COMING_TITLE} barcode="accountComing">
      <RowFrame>
        <Note>{COMING_LINE}</Note>
      </RowFrame>
      {COMING.map((f) => (
        <RowFrame key={f.title}>
          <XStack alignItems="center" gap="3">
            <YStack flex={1} minWidth={0} gap={2}>
              <PlainText fontSize={16} fontWeight="600">
                {f.title}
              </PlainText>
              <PlainText fontSize={13} color="muted">
                {f.line}
              </PlainText>
            </YStack>
            <Stamp tone="secondary">{COMING_STAMP}</Stamp>
          </XStack>
        </RowFrame>
      ))}
    </RowGroup>
  );
}
