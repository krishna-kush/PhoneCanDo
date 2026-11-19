import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import { useReduceMotion } from '../useReduceMotion';

// A spring that overshoots: turned on, the fill lands like a stamp.
const POP = { damping: 7, stiffness: 260 };

type Props = {
  on: boolean;
  /** Fills and empties at once, with no pop (a switch whose row moves enough already). */
  instant?: boolean;
};

// A switch's or a choice's mark: a square, its fill red when on (picked),
// as the site's kicker squares. Turned on, the fill pops in past its size
// and settles; turned off, it shrinks away; `instant`, it just is.
export default function SquareMark({ on, instant = false }: Props) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    fill.value = reduce || instant ? (on ? 1 : 0) : withSpring(on ? 1 : 0, POP);
  }, [on, reduce, instant, fill]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: Math.max(0, fill.value) }] }));
  return (
    <YStack
      width={20}
      height={20}
      borderWidth={1.5}
      borderColor={on ? 'primary' : 'lineStrong'}
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Animated.View style={style}>
        <YStack width={10} height={10} backgroundColor="primary" />
      </Animated.View>
    </YStack>
  );
}
