import { Pressable } from 'react-native';
import { YStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import type { Mood } from '../../common/face/mood';
import { HIT } from '../../common/globals';
import { UNTUCK_LABEL } from './copy';
import { GUIDE_LOOK } from './guide';

// The guide tucked away: only A-09's face, waiting in a corner of the
// screen; a tap brings the bubble back. The pointer stays on the spot.
export default function TuckedGuide({ left, top, mood, onUntuck }: { left: number; top: number; mood: Mood; onUntuck: () => void }) {
  return (
    <Pressable
      onPress={onUntuck}
      accessibilityRole="button"
      accessibilityLabel={UNTUCK_LABEL}
      style={{ position: 'absolute', left, top, width: HIT.minTouch, height: HIT.minTouch }}
    >
      <YStack
        flex={1}
        alignItems="center"
        justifyContent="center"
        backgroundColor="panel"
        borderWidth={1}
        borderColor="lineStrong"
        boxShadow="3px 3px 0 secondary"
      >
        <AgentFace mood={mood} mascot={GUIDE_LOOK} size={26} />
      </YStack>
    </Pressable>
  );
}
