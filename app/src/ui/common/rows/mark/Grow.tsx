import Animated, { interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import { useTheme } from '../../globals';
import { type MarkProps, useMarkProgress } from './progress';

// The plain square, as the site's kicker squares: turned on, the red fill
// grows from nothing as it fades in and the border turns red with it;
// turned off, both go back.
const PACE = { inMs: 240 };
const BOX = 20;
const FILL = 10;

export default function Grow({ on, instant = false }: MarkProps) {
  const t = useTheme();
  const p = useMarkProgress(on, instant, PACE);
  const off = t.lineStrong;
  const red = t.primary;
  const frame = useAnimatedStyle(() => ({ borderColor: interpolateColor(p.value, [0, 1], [off, red]) }));
  const fill = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: p.value }] }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: BOX, height: BOX, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }, frame]}
    >
      <Animated.View style={[{ width: FILL, height: FILL, backgroundColor: red }, fill]} />
    </Animated.View>
  );
}
