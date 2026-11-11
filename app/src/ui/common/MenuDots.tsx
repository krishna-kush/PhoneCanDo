import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import DotsIcon from './DotsIcon';
import { useReduceMotion } from './useReduceMotion';

// The ⋮ of a menu, alive: while its menu is open the dots spring a quarter
// turn into ⋯ and go red, and swing back when it shuts. Still under
// "Remove animations" (it only turns red).
export default function MenuDots({ open }: { open: boolean }) {
  const reduce = useReduceMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    const to = open ? 1 : 0;
    turn.value = reduce ? to : open ? withSpring(to, { damping: 9, stiffness: 260 }) : withTiming(to, { duration: 160 });
  }, [open, reduce, turn]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }));

  return (
    <Animated.View style={style}>
      <DotsIcon color={open ? 'primary' : 'color'} />
    </Animated.View>
  );
}
