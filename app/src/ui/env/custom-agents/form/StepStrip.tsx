import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../../common/PlainText';
import { useReduceMotion } from '../../../common/useReduceMotion';
import { stepLabel, stepSpoken } from '../logic/badge';

// A little overshoot as the step's bar runs in.
const RUN = { damping: 14, stiffness: 180 };

// Where the custom agent pages are, as a site figure's scale: a bar per
// step, red once it is behind, amber for the one you're on (it runs in
// from the left as the page opens), a hairline for the ones ahead, each
// with its number and name under it ("01 Fill in", "✓ Fill in" once done).
export default function StepStrip({ steps, at }: { steps: readonly string[]; at: number }) {
  return (
    <XStack gap="2" accessibilityRole="text" accessibilityLabel={stepSpoken(steps, at)}>
      {steps.map((step, i) => (
        <YStack key={step} flex={1} gap={6}>
          <YStack height={3} backgroundColor="line" overflow="hidden">
            {i < at ? <YStack flex={1} backgroundColor="primary" /> : i === at ? <RunningBar /> : null}
          </YStack>
          <PlainText
            fontFamily="mono"
            fontSize={10}
            fontWeight="600"
            letterSpacing={1.4}
            textTransform="uppercase"
            color={i === at ? 'secondaryInk' : i < at ? 'dim' : 'faint'}
            numberOfLines={1}
          >
            {stepLabel(steps, i, at)}
          </PlainText>
        </YStack>
      ))}
    </XStack>
  );
}

// The step you're on: its amber bar springs in from the left.
function RunningBar() {
  const reduce = useReduceMotion();
  const fill = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    fill.value = reduce ? 1 : withSpring(1, RUN);
  }, [reduce, fill]);
  const style = useAnimatedStyle(() => ({ flex: 1, transformOrigin: 'left', transform: [{ scaleX: fill.value }] }));
  return (
    <Animated.View style={style}>
      <YStack flex={1} backgroundColor="secondary" />
    </Animated.View>
  );
}
