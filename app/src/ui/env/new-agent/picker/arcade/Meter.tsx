import { useEffect } from 'react';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import { METER_MAX } from '../logic/facts';

/** One segment's size, in dp. */
const SEG_W = 12;
const SEG_H = 7;
const SEG_GAP = 2;
/** How long one segment takes to fill. */
const SEG_MS = 110;

/** A meter's width, for a row that has none to keep its column. */
export const METER_W = METER_MAX * SEG_W + (METER_MAX - 1) * SEG_GAP;

// A fact's meter, as an arcade's stat bar: METER_MAX segments filling
// amber from the left, run again from empty each time `replay` changes
// (another applicant picked), on the UI thread.
export default function Meter({ value, replay }: { value: number; replay: string }) {
  const reduce = useReduceMotion();
  const fill = useSharedValue(reduce ? value : 0);
  useEffect(() => {
    fill.value = reduce
      ? value
      : withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(120, withTiming(value, { duration: SEG_MS * value, easing: Easing.linear })),
        );
  }, [value, replay, reduce, fill]);
  return (
    <XStack gap={SEG_GAP} width={METER_W} flexShrink={0}>
      {Array.from({ length: METER_MAX }, (_, i) => (
        <Segment key={i} at={i} fill={fill} />
      ))}
    </XStack>
  );
}

function Segment({ at, fill }: { at: number; fill: SharedValue<number> }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.min(1, Math.max(0, fill.value - at)) }] }));
  return (
    <YStack width={SEG_W} height={SEG_H} backgroundColor="line" overflow="hidden">
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: 0, width: SEG_W, height: SEG_H, transformOrigin: 'left' }, style]}
      >
        <YStack flex={1} backgroundColor="secondary" />
      </Animated.View>
    </YStack>
  );
}
