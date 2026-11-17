import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { YStack } from 'tamagui';
import PlainText from '../../../../../common/PlainText';
import { useReduceMotion } from '../../../../../common/useReduceMotion';
import { usePageActive } from '../../../../../nav/pageActive';
import { VS_STICKER, VS_STICKER_LABEL } from '../../copy';

/** Its lean, and how far a wiggle swings it, in degrees. */
const LEAN = -8;
const SWING = 6;
/** How long it rests between wiggles. */
const REST_MS = 3400;
/** A press: down fast, back with a bounce. */
const POP = { damping: 8, stiffness: 300 };

// The way into VS mode, slapped on the showcase like a sticker: "VS" on a
// red square, leaning, on the hard amber shadow, with what it does under
// it. Every few seconds it gives a little wiggle to be noticed (still
// while its page is covered or with reduce motion); a press squashes it
// and it springs back; a tap brings a challenger in.
export default function VsSticker({ onPress }: { onPress: () => void }) {
  const reduce = useReduceMotion();
  const active = usePageActive();
  const tilt = useSharedValue(LEAN);
  const squash = useSharedValue(1);
  useEffect(() => {
    tilt.value = LEAN;
    if (reduce || !active) return;
    tilt.value = withRepeat(
      withSequence(
        withDelay(REST_MS, withTiming(LEAN - SWING, { duration: 110 })),
        withTiming(LEAN + SWING, { duration: 110 }),
        withTiming(LEAN - SWING / 2, { duration: 100 }),
        withTiming(LEAN, { duration: 100 }),
      ),
      -1,
    );
  }, [reduce, active, tilt]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }, { scale: squash.value }] }));
  return (
    <Animated.View style={style}>
      <YStack
        width={60}
        paddingVertical={6}
        alignItems="center"
        backgroundColor="primary"
        boxShadow="3px 3px 0 secondary"
        hitSlop={10}
        onPressIn={() => {
          if (!reduce) squash.value = withTiming(0.88, { duration: 70 });
        }}
        onPressOut={() => {
          squash.value = reduce ? 1 : withSpring(1, POP);
        }}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={VS_STICKER_LABEL}
      >
        <PlainText fontSize={24} fontWeight="700" color="onPrimary" letterSpacing={-1}>
          VS
        </PlainText>
        <PlainText fontFamily="mono" fontSize={7} fontWeight="600" letterSpacing={1} color="onPrimary" textTransform="uppercase">
          {VS_STICKER}
        </PlainText>
      </YStack>
    </Animated.View>
  );
}
