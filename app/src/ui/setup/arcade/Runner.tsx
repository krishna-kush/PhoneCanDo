import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { Look } from '../../../../../mascot/look.ts';
import AgentFace from '../../common/face/AgentFace';
import { useReduceMotion } from '../../common/useReduceMotion';
import { runnerMood, type SetupState } from '../logic/stage';
import { useStageHop } from './useStageHop';

/** The runner's room on the track, in dp. */
export const RUNNER_W = 48;
/** Its stride: a bob up and down while it runs, and how fast it catches up along the track. */
const BOB = 5;
const BOB_MS = 160;
const MOVE_MS = 500;

type Props = { state: SetupState; x: number; mascot: Look };

// The agent running along the arcade's track: it bobs as it runs, its
// eyes darting left and right, and slides on to [x] as the setup gets
// further; at the finale it stops at
// the flag, beaming, and jumps; on a failure it stops, frowning.
export default function Runner({ state, x, mascot }: Props) {
  const reduce = useReduceMotion();
  const hop = useStageHop(state);
  const running = !state.done && !state.failed;
  const along = useSharedValue(x);
  const bob = useSharedValue(0);
  useEffect(() => {
    along.value = reduce ? x : withTiming(x, { duration: MOVE_MS });
  }, [x, reduce, along]);
  useEffect(() => {
    if (reduce || !running) {
      cancelAnimation(bob);
      bob.value = withTiming(0, { duration: 120 });
      return;
    }
    bob.value = withRepeat(withSequence(withTiming(-BOB, { duration: BOB_MS }), withTiming(0, { duration: BOB_MS })), -1);
  }, [running, reduce, bob]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: along.value }, { translateY: bob.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: 0, bottom: 0, width: RUNNER_W, alignItems: 'center' }, style]}>
      <AgentFace mood={runnerMood(state)} size={28} mascot={mascot} hop={hop} hearts={3} />
    </Animated.View>
  );
}
