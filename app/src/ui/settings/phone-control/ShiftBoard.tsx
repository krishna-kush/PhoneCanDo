import { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import BoopFace from '../../common/face/BoopFace';
import { useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { useReduceMotion } from '../../common/useReduceMotion';
import { boardLine } from './copy';

// A pop that overshoots, as a bubble that just got something to say.
const POP = { damping: 9, stiffness: 260 };

// The head of Settings: A-01 on its shift with its line in a speech bubble
// beside it. A tap makes it hop and say the next thing; each new line pops
// the bubble.
export default function ShiftBoard({ active }: { active: boolean }) {
  const t = useTheme();
  const reduce = useReduceMotion();
  const [seed] = useState(() => Math.random() * 1000);
  const [boops, setBoops] = useState(0);
  const line = boardLine(seed, boops);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (reduce || boops === 0) return;
    pop.value = 0.85;
    pop.value = withSpring(1, POP);
  }, [boops, reduce, pop]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <XStack alignItems="center" gap="2" paddingBottom="1">
      <BoopFace mood="awake" size={26} still={!active} label="A-01, the mascot. Tap it." onBoop={setBoops} />
      <Animated.View style={[{ flexShrink: 1, flexDirection: 'row', alignItems: 'center' }, style]}>
        <Svg width={7} height={12} viewBox="0 0 7 12">
          <Path d="M7 0.5 L0.8 6 L7 11.5" fill={t.panel} stroke={t.lineStrong} strokeWidth={1} />
        </Svg>
        <YStack
          marginLeft={-1}
          flexShrink={1}
          paddingHorizontal="2"
          paddingVertical={6}
          borderWidth={1}
          borderColor="lineStrong"
          backgroundColor="panel"
        >
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="secondaryInk" textTransform="uppercase" numberOfLines={2}>
            {`A-01 · ${line}`}
          </PlainText>
        </YStack>
      </Animated.View>
    </XStack>
  );
}
