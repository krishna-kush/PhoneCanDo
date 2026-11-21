import { View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import { useTheme } from '../../globals';
import PlainText from '../../PlainText';
import { type MarkProps, stage, useMarkProgress } from './progress';

const W = 46;
const H = 28;
// How much larger the stamp is in the air than on the paper.
const LIFT = 0.5;

// The site's rubber stamp as the switch: off, "OFF" pencilled faint in a
// dashed box, a place waiting for a stamp; turned on, a red "ON" stamp,
// tilted, comes down from larger and faint and presses on at its size as
// the pencil goes under it; turned off, the stamp lifts away and the
// pencil shows again. It lands with an ease, never the bounce of a slam.
export default function StampWord({ on, instant = false }: MarkProps) {
  const t = useTheme();
  const p = useMarkProgress(on, instant, { inMs: 300, outMs: 200 });
  const pencil = useAnimatedStyle(() => ({ opacity: 1 - stage(p.value, 0.35, 0.7) }));
  const stamp = useAnimatedStyle(() => ({
    opacity: 0.92 * stage(p.value, 0, 0.45),
    transform: [{ rotate: '-6deg' }, { scale: 1 + LIFT * (1 - p.value) }],
  }));
  return (
    <View
      style={{ width: W, height: H, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Animated.View style={pencil}>
        <YStack borderWidth={1} borderStyle="dashed" borderColor="lineStrong" paddingHorizontal={5} paddingVertical={2}>
          <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} color="faint">
            OFF
          </PlainText>
        </YStack>
      </Animated.View>
      <Animated.View
        style={[
          {
            position: 'absolute',
            borderWidth: 1.5,
            borderColor: t.primary,
            backgroundColor: t.primarySoft,
            paddingHorizontal: 6,
            paddingVertical: 2,
          },
          stamp,
        ]}
      >
        <PlainText fontFamily="mono" fontWeight="700" fontSize={12} letterSpacing={1.6} color="primary">
          ON
        </PlainText>
      </Animated.View>
    </View>
  );
}
