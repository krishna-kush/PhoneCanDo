import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { XStack } from 'tamagui';
import PlainText from './PlainText';
import { useReduceMotion } from './useReduceMotion';

// What the flag says.
const LABEL = 'P1';
// On, then off, this long each: an arcade's blink, in steps.
const ON_MS = 700;
const OFF_MS = 300;

// The player's flag, red with "P1" on it, blinking as an arcade's player
// cursor does (Choose agent's picked applicant, the setup screen's player
// line); it holds still while `still` (its page is
// covered) or with reduce motion.
export default function P1Flag({ still = false, small = false }: { still?: boolean; small?: boolean }) {
  const reduce = useReduceMotion();
  const on = useSharedValue(1);
  useEffect(() => {
    on.value = 1;
    if (reduce || still) return;
    on.value = withRepeat(
      withSequence(withDelay(ON_MS, withTiming(0, { duration: 0 })), withDelay(OFF_MS, withTiming(1, { duration: 0 }))),
      -1,
    );
  }, [reduce, still, on]);
  const style = useAnimatedStyle(() => ({ opacity: on.value }));
  return (
    <Animated.View style={[{ alignSelf: 'flex-start' }, style]}>
      <XStack backgroundColor="primary" paddingHorizontal={small ? 3 : 5} paddingVertical={small ? 0 : 1}>
        <PlainText fontFamily="mono" fontSize={small ? 9 : 10} fontWeight="600" letterSpacing={1} color="onPrimary">
          {LABEL}
        </PlainText>
      </XStack>
    </Animated.View>
  );
}
