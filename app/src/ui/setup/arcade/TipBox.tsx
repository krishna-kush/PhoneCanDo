import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { XStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { useReduceMotion } from '../../common/useReduceMotion';
import { ARCADE } from '../copy';
import { tipAt } from '../logic/clock';

/** A new tip this often. */
const TIP_MS = 5000;

// A loading screen's tip under the arcade's track: an amber TIP tag and a
// line about the app, fading to the next one every few seconds.
export default function TipBox({ elapsed }: { elapsed: number }) {
  const reduce = useReduceMotion();
  const at = tipAt(elapsed, TIP_MS, ARCADE.tips.length);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (!reduce) fade.value = withSequence(withTiming(0, { duration: 0 }), withTiming(1, { duration: 360 }));
  }, [at, reduce, fade]);
  const style = useAnimatedStyle(() => ({ opacity: fade.value, flex: 1 }));
  return (
    <XStack gap="3" alignItems="flex-start" minHeight={36}>
      <XStack backgroundColor="secondary" paddingHorizontal={5} paddingVertical={1} marginTop={1}>
        <PlainText fontFamily="mono" fontSize={10} fontWeight="600" letterSpacing={1.2} textTransform="uppercase" color="bg">
          {ARCADE.tip}
        </PlainText>
      </XStack>
      <Animated.View style={style}>
        <PlainText fontSize={13} color="muted" numberOfLines={2}>
          {ARCADE.tips[at]}
        </PlainText>
      </Animated.View>
    </XStack>
  );
}
