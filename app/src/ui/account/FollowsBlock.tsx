import { XStack, YStack } from 'tamagui';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import SquareMark from '../common/rows/SquareMark';
import Note from '../env/parts/Note';
import { FOLLOWS, FOLLOWS_TITLE, FOLLOWS_TITLE_OUT, followsNow } from './logic/pass';

// The settings that come with a signed-in person, as a key box: each with
// its square, filled once it follows you (it pops in on sign-in), else
// kept on this phone; `note` on the first row says how.
export default function FollowsBlock({ signedIn, note }: { signedIn: boolean; note?: string }) {
  return (
    <RowGroup title={signedIn ? FOLLOWS_TITLE : FOLLOWS_TITLE_OUT} barcode="accountFollows">
      {note ? (
        <RowFrame>
          <Note>{note}</Note>
        </RowFrame>
      ) : null}
      {FOLLOWS.map((f) => (
        <RowFrame key={f.title}>
          <XStack alignItems="center" gap="3">
            <SquareMark on={signedIn} />
            <YStack flex={1} minWidth={0} gap={2}>
              <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
                {f.title}
              </PlainText>
              <PlainText fontSize={13} color="muted">
                {f.line}
              </PlainText>
            </YStack>
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color={signedIn ? 'secondaryInk' : 'dim'}>
              {followsNow(signedIn)}
            </PlainText>
          </XStack>
        </RowFrame>
      ))}
    </RowGroup>
  );
}
