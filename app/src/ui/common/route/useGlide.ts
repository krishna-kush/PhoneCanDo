import { useEffect } from 'react';
import { Easing, type SharedValue, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReduceMotion } from '../../common/useReduceMotion';

// Progress lands four times a second; the glide covers the gap between.
const GLIDE_MS = 450;

/** The download's share done (0 to 1), gliding to each new value on the UI thread; straight there with animations off. */
export function useGlide(fraction: number): SharedValue<number> {
  const reduce = useReduceMotion();
  const value = useSharedValue(fraction);
  useEffect(() => {
    value.value = reduce ? fraction : withTiming(fraction, { duration: GLIDE_MS, easing: Easing.out(Easing.quad) });
  }, [fraction, reduce, value]);
  return value;
}
