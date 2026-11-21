import { XStack, YStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import Plate from '../../common/Plate';
import KeyHead from '../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../common/rows/place';
import SwitchRow from '../../common/rows/SwitchRow';
import { DESK_LOOK, DESK_SERIAL } from '../../common/slip/desk';
import { ALLOW_ALL_TITLE, allowAllMore, allowAllNote, DESK_GROUP, DESK_ROLE, deskLine } from '../copy';

type Props = {
  on: boolean;
  busy: boolean;
  onToggle: () => void;
};

// The Apps page's front desk, a printed plate on the amber shadow: A-04,
// our own front-desk unit, saying in a speech bubble how the door is kept
// (each new app knocks first, or open house while Allow all apps is on,
// when it is pleased), and under it the Allow all apps switch.
export default function FrontDesk({ on, busy, onToggle }: Props) {
  return (
    <Plate>
      <KeyHead title={DESK_GROUP} barcode="frontDesk" />
      <XStack padding={ROW_GUTTER} gap="3" alignItems="flex-start">
        <AgentFace mood={on ? 'happy' : 'awake'} mascot={DESK_LOOK} size={40} />
        <YStack flex={1} minWidth={0} gap={8}>
          <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="dim">
            {`${DESK_SERIAL} · ${DESK_ROLE}`}
          </PlainText>
          <YStack borderWidth={1} borderColor="lineStrong" backgroundColor="bg" paddingHorizontal="3" paddingVertical="2">
            {/* The bubble's tail, toward A-04. */}
            <YStack
              position="absolute"
              left={-5}
              top={10}
              width={9}
              height={9}
              backgroundColor="bg"
              borderLeftWidth={1}
              borderBottomWidth={1}
              borderColor="lineStrong"
              rotate="45deg"
            />
            <PlainText fontSize={14}>{deskLine(on)}</PlainText>
          </YStack>
        </YStack>
      </XStack>
      <YStack borderTopWidth={1} borderColor="line" paddingHorizontal={ROW_GUTTER - 7} paddingVertical="1">
        <SwitchRow title={ALLOW_ALL_TITLE} on={on} onToggle={onToggle} note={allowAllNote(on)} more={allowAllMore(on)} busy={busy} />
      </YStack>
    </Plate>
  );
}
