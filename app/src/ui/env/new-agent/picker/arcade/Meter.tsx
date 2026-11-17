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
import { METER_MAX } from '../logic/meter';

/** One segment's size, in dp. */
const SEG_W = 12;
const SEG_H = 7;
const SEG_GAP = 2;
/** How long one segment takes to fill. */
const SEG_MS = 110;

/** A meter's width, for a row that has none to keep its column. */
export const METER_W = METER_MAX * SEG_W + (METER_MAX - 1) * SEG_GAP;

type Props = {
  value: number;
  /** Runs again from empty each time this changes (another applicant picked). */
  replay: string;
  /** Filling from the right: VS mode's left fighter, its bars facing out. */
  mirror?: boolean;
};

// A fact's meter, as an arcade's stat bar: METER_MAX segments filling
// amber from the left (from the right when mirrored), run again from empty
// each time `replay` changes, on the UI thread.
export default function Meter({ value, replay, mirror = false }: Props) {
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
    <XStack gap={SEG_GAP} width={METER_W} flexShrink={0} flexDirection={mirror ? 'row-reverse' : 'row'}>
      {Array.from({ length: METER_MAX }, (_, i) => (
        <Segment key={i} at={i} fill={fill} mirror={mirror} />
      ))}
    </XStack>
  );
}

function Segment({ at, fill, mirror }: { at: number; fill: SharedValue<number>; mirror: boolean }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: Math.min(1, Math.max(0, fill.value - at)) }] }));
  return (
    <YStack width={SEG_W} height={SEG_H} backgroundColor="line" overflow="hidden">
      <Animated.View
        style={[{ position: 'absolute', left: 0, top: 0, width: SEG_W, height: SEG_H, transformOrigin: mirror ? 'right' : 'left' }, style]}
      >
        <YStack flex={1} backgroundColor="secondary" />
      </Animated.View>
    </YStack>
  );
}
