import { type ComponentProps, useEffect, useRef } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import PlainText from '../../../common/PlainText';
import { useReduceMotion } from '../../../common/useReduceMotion';

type Props = Omit<ComponentProps<typeof PlainText>, 'children'> & { text: string };

// The flap falls past the hinge, then settles.
const FALL = { duration: 260, easing: Easing.out(Easing.back(1.8)) };

// A word or digits on a split-flap board: when the text changes, the new
// one falls in from the hinge like a departure board's flap. The first
// text shows as it is; with reduced motion every one does.
export default function FlipText({ text, ...look }: Props) {
  const reduce = useReduceMotion();
  const flap = useSharedValue(1);
  const shown = useRef(text);

  useEffect(() => {
    if (shown.current === text) return;
    shown.current = text;
    if (reduce) return;
    flap.value = 0;
    flap.value = withTiming(1, FALL);
  }, [text, reduce, flap]);

  const style = useAnimatedStyle(() => ({
    transform: [{ perspective: 400 }, { rotateX: `${(1 - flap.value) * 90}deg` }],
  }));

  return (
    <Animated.View style={style}>
      <PlainText {...look}>{text}</PlainText>
    </Animated.View>
  );
}
