import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';
import { YStack } from 'tamagui';
import { useTheme } from '../../common/globals';
import { useReduceMotion } from '../../common/useReduceMotion';

// How far the strips run down out of the slot, and how long one pass takes.
const DROP = 4;
const PASS_MS = 420;

// Delete my data's mark: a shredder, its slot on top and paper strips under
// it in red. While the data goes, the strips keep running down out of it.
export default function Shredder({ shredding, size = 22 }: { shredding: boolean; size?: number }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const run = useSharedValue(0);
  useEffect(() => {
    run.value = 0;
    if (shredding && !reduce) run.value = withRepeat(withTiming(1, { duration: PASS_MS }), -1, false);
  }, [shredding, reduce, run]);
  const strips = useAnimatedStyle(() => ({ transform: [{ translateY: run.value * DROP }], opacity: 1 - run.value * 0.6 }));
  return (
    <YStack width={size} height={size} overflow="hidden" flexShrink={0}>
      <Svg width={size} height={size} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
        <Rect x={3} y={4} width={18} height={6} stroke={t.primary} strokeWidth={1.6} fill="none" />
        <Line x1={6} x2={18} y1={7} y2={7} stroke={t.primary} strokeWidth={1.2} />
      </Svg>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, strips]}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          {[7, 10.5, 14, 17.5].map((x) => (
            <Line key={x} x1={x} x2={x} y1={12} y2={21} stroke={t.primary} strokeWidth={1.6} strokeDasharray="3 1.5" />
          ))}
        </Svg>
      </Animated.View>
    </YStack>
  );
}
