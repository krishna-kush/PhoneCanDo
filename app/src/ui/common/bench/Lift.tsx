import { type ReactNode, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useReduceMotion } from '../useReduceMotion';

// How far a thing outside the count sits up out of its place, and the
// spring it drops in with (a little bounce as it seats).
const LIFT = 8;
const SEAT = { damping: 8, stiffness: 240 };

// What sits on a bench's place (a cartridge, a chat bubble): inside the
// count it drops into its place; outside it lifts out.
export default function Lift({ up, children }: { up: boolean; children: ReactNode }) {
  const reduce = useReduceMotion();
  const lift = useSharedValue(up ? 1 : 0);
  useEffect(() => {
    lift.value = reduce ? (up ? 1 : 0) : withSpring(up ? 1 : 0, SEAT);
  }, [up, reduce, lift]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * LIFT }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
