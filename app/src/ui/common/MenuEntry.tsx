import { useEffect, type ReactNode } from 'react';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useReduceMotion } from './useReduceMotion';

// One row of an opening menu: it slides in from the right a beat after the
// one above it, so the rows deal out like cards. In place at once under
// "Remove animations".
export default function MenuEntry({ index, children }: { index: number; children: ReactNode }) {
  const reduce = useReduceMotion();
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = reduce ? 1 : withDelay(30 + index * 45, withSpring(1, { damping: 13, stiffness: 240 }));
  }, [index, reduce, shown]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(shown.value, [0, 0.6], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: (1 - shown.value) * 22 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
