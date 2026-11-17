import { type ReactNode, useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useReduceMotion } from '../../common/useReduceMotion';

/** The landing: quick, with a little bounce. */
const LAND = { damping: 11, stiffness: 240 };

type Props = {
  children: ReactNode;
  /** pop: grows in where it stands; drop: falls in from above. */
  how?: 'pop' | 'drop';
  style?: object;
};

// Something turning up on a scene as it mounts (a callout, the agent on its
// box, a headline): it pops or drops in and settles.
export default function PopIn({ children, how = 'pop', style }: Props) {
  const reduce = useReduceMotion();
  const v = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) v.value = withSpring(1, LAND);
  }, [reduce, v]);
  const anim = useAnimatedStyle(() => ({
    opacity: Math.min(1, v.value * 1.5),
    transform: how === 'drop' ? [{ translateY: (1 - v.value) * -36 }] : [{ scale: 0.6 + 0.4 * v.value }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
