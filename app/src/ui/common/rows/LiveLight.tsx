import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import { useReduceMotion } from '../useReduceMotion';

// Half of the site's blink (`blink 2.4s steps(1)`): on, then off, this long each.
const HALF_MS = 1200;

// A small red square that blinks, as the site's status lights do (the
// slate's rec dot, the passport bar's state): something here is live. It
// holds still while `still` (its page is covered) or with reduce motion.
export default function LiveLight({ still = false }: { still?: boolean }) {
  const reduce = useReduceMotion();
  const on = useSharedValue(1);
  useEffect(() => {
    on.value = 1;
    if (reduce || still) return;
    on.value = withRepeat(
      withSequence(withDelay(HALF_MS, withTiming(0, { duration: 0 })), withDelay(HALF_MS, withTiming(1, { duration: 0 }))),
      -1,
    );
  }, [reduce, still, on]);
  const style = useAnimatedStyle(() => ({ opacity: on.value }));
  return (
    <Animated.View style={style}>
      <YStack width={6} height={6} backgroundColor="primary" />
    </Animated.View>
  );
}
