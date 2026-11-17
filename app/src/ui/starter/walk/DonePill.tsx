import { useEffect } from 'react';
import { View } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { MissionId } from '../../../state/logic/starter/missions';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import Stamp from '../../common/Stamp';
import TextAction from '../../drawer/select/TextAction';
import { DONE_STAMP } from '../copy';
import { CLOSE, DONE_CAPTION, doneLine, NEXT_JOB } from './copy';
import { GUIDE_LOOK, GUIDE_SERIAL } from './guide';
import { SIDE } from './WalkBubble';

/** How long the stamp stays before the walk ends by itself. */
const STAYS_MS = 8000;

type Props = {
  mission: MissionId;
  title: string;
  top: number;
  width: number;
  /** Back to the first shift, for the next job. */
  onNext: () => void;
  onClose: () => void;
};

// The walk's end: the job is seen done, so the guide (A-09) is happy, DONE
// slams down and a line says what now. Next job goes back to the first
// shift; it closes by itself after a while, so it never sits on what comes
// next.
export default function DonePill({ mission, title, top, width, onNext, onClose }: Props) {

  useEffect(() => {
    const timer = setTimeout(onClose, STAYS_MS);
    return () => clearTimeout(timer);
  }, [mission, onClose]);

  return (
    <View style={{ position: 'absolute', left: SIDE, top, width }}>
      <YStack backgroundColor="panel" borderWidth={1} borderColor="lineStrong" boxShadow="3px 3px 0 secondary" padding="3" gap="2">
        <XStack alignItems="center" gap="2">
          <AgentFace mood="happy" mascot={GUIDE_LOOK} size={24} />
          <PlainText fontFamily="mono" fontSize={11} fontWeight="600" letterSpacing={1.4} color="secondaryInk">
            {`${GUIDE_SERIAL} ·`}
          </PlainText>
          <PlainText flexShrink={1} fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase" numberOfLines={1}>
            {title}
          </PlainText>
          <PlainText flex={1} fontFamily="mono" fontSize={11} letterSpacing={1.4} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
            {`· ${DONE_CAPTION}`}
          </PlainText>
          <Stamp slam>{DONE_STAMP}</Stamp>
        </XStack>
        <PlainText fontSize={15}>{doneLine(mission)}</PlainText>
        <XStack justifyContent="flex-end" alignItems="center" gap="6" paddingTop="1">
          <TextAction label={CLOSE} onPress={onClose} />
          <TextAction label={NEXT_JOB} onPress={onNext} />
        </XStack>
      </YStack>
    </View>
  );
}
