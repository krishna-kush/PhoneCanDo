import { useEffect } from 'react';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { XStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { useReduceMotion } from '../../common/useReduceMotion';
import type { SetupState } from '../logic/stage';
import { ARCADE } from '../copy';
import PopIn from './PopIn';

/** One dot's turn in the loading dots' wave, and the wave's length. */
const DOT_MS = 280;
const WAVE_MS = DOT_MS * 4;

// The arcade's headline in big mono capitals: NOW LOADING with three dots
// lighting in turn; STAGE CLEAR! in red, popping in, at the finale;
// CONTINUE? blinking on a failure.
export default function Headline({ state }: { state: SetupState }) {
  if (state.done) {
    return (
      <PopIn style={{ alignSelf: 'center' }}>
        <Big color="primary">{ARCADE.clear}</Big>
      </PopIn>
    );
  }
  if (state.failed) return <Blinking />;
  return (
    <XStack alignSelf="center" alignItems="flex-end">
      <Big>{ARCADE.loading}</Big>
      <Dots />
    </XStack>
  );
}

function Big({ children, color = 'fg' }: { children: string; color?: 'fg' | 'primary' }) {
  return (
    <PlainText fontFamily="mono" fontSize={22} fontWeight="700" letterSpacing={2} textTransform="uppercase" color={color}>
      {children}
    </PlainText>
  );
}

function Dots() {
  const reduce = useReduceMotion();
  const wave = useSharedValue(0);
  useEffect(() => {
    wave.value = 0;
    if (!reduce) wave.value = withRepeat(withTiming(1, { duration: WAVE_MS }), -1);
  }, [reduce, wave]);
  return (
    <XStack>
      {[0, 1, 2].map((i) => (
        <Dot key={i} at={i} wave={wave} still={reduce} />
      ))}
    </XStack>
  );
}

function Dot({ at, wave, still }: { at: number; wave: SharedValue<number>; still: boolean }) {
  const style = useAnimatedStyle(() => ({ opacity: still || wave.value * 4 > at + 1 ? 1 : 0.15 }));
  return (
    <Animated.View style={style}>
      <PlainText fontFamily="mono" fontSize={22} fontWeight="700" color="secondaryInk">
        .
      </PlainText>
    </Animated.View>
  );
}

function Blinking() {
  const reduce = useReduceMotion();
  const on = useSharedValue(1);
  useEffect(() => {
    on.value = 1;
    if (!reduce)
      on.value = withRepeat(
        withSequence(withDelay(600, withTiming(0, { duration: 0 })), withDelay(400, withTiming(1, { duration: 0 }))),
        -1,
      );
  }, [reduce, on]);
  const style = useAnimatedStyle(() => ({ opacity: on.value }));
  return (
    <Animated.View style={[{ alignSelf: 'center' }, style]}>
      <Big color="primary">{ARCADE.stopped}</Big>
    </Animated.View>
  );
}
