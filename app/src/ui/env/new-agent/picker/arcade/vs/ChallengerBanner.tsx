import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import PlainText from '../../../../../common/PlainText';
import { useReduceMotion } from '../../../../../common/useReduceMotion';
import { NEW_CHALLENGER } from '../../copy';

/** How long the banner holds across the plate. */
const HOLD_MS = 1300;
const IN_MS = 220;
const OUT_MS = 260;

// As a challenger steps in, a fighting game's "here comes a new challenger!":
// a red banner sweeps in across the fighters from the right, holds, then
// fades, and is gone. Once per VS: it shows as the VS plate comes up.
// With reduce motion it just shows, then goes.
export default function ChallengerBanner() {
  const reduce = useReduceMotion();
  const width = useWindowDimensions().width;
  const [up, setUp] = useState(true);
  const x = useSharedValue(reduce ? 0 : 1);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (!reduce) {
      x.value = withTiming(0, { duration: IN_MS, easing: Easing.out(Easing.cubic) });
      fade.value = withDelay(IN_MS + HOLD_MS, withTiming(0, { duration: OUT_MS }));
    }
    const t = setTimeout(() => setUp(false), IN_MS + HOLD_MS + OUT_MS);
    return () => clearTimeout(t);
  }, [reduce, x, fade]);
  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: x.value * width }, { skewX: '-12deg' }],
  }));
  if (!up) return null;
  return (
    <YStack position="absolute" left={-8} right={-8} top={44} zIndex={2} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Animated.View style={style}>
        <YStack backgroundColor="primary" paddingVertical={10} alignItems="center" boxShadow="0px 4px 0 secondary">
          <PlainText fontFamily="mono" fontSize={13} fontWeight="700" letterSpacing={1.5} color="onPrimary" textTransform="uppercase">
            {NEW_CHALLENGER}
          </PlainText>
        </YStack>
      </Animated.View>
    </YStack>
  );
}
