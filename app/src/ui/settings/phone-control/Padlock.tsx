import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { YStack } from 'tamagui';
import { useTheme } from '../../common/globals';
import { useReduceMotion } from '../../common/useReduceMotion';

// The shackle pops up past its stop, as a lock does when it springs open.
const SPRING = { damping: 8, stiffness: 240 };

// The phone-control lock's mark: a padlock in amber ink while locked; once
// unlocked its shackle springs up out of the body and it turns red (agents
// can see and tap the phone now). Locking pulls the shackle back down.
export default function Padlock({ open, size = 28 }: { open: boolean; size?: number }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const lift = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    lift.value = reduce ? (open ? 1 : 0) : withSpring(open ? 1 : 0, SPRING);
  }, [open, reduce, lift]);

  const shackle = useAnimatedStyle(() => ({ transform: [{ translateY: -lift.value * size * 0.2 }] }));
  const ink = open ? t.primary : t.secondaryInk;

  return (
    <YStack width={size} height={size} flexShrink={0} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, shackle]}>
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M7.5 12V8a4.5 4.5 0 0 1 9 0v4" stroke={ink} strokeWidth={2} fill="none" />
        </Svg>
      </Animated.View>
      <Svg width={size} height={size} viewBox="0 0 24 24" style={StyleSheet.absoluteFill}>
        <Rect x={4.5} y={11} width={15} height={11} fill={ink} />
        <Rect x={11} y={14.5} width={2} height={4} fill={t.panel} />
      </Svg>
    </YStack>
  );
}
