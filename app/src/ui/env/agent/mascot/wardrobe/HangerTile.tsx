import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import MascotChoice, { type ChoiceProps } from '../MascotChoice';

/** The hook a tile hangs by, in dp. */
const HOOK = 9;

// The swing a press gives a tile: out, back and settling, in degrees and ms.
const SWING: readonly [number, number][] = [
  [-7, 110],
  [5, 170],
  [-3, 170],
  [1.5, 170],
  [0, 200],
];

// The rail over each row of the wardrobe: a rod with a square at each end
// in the agent's front colour, red, or amber once its colours are swapped.
export function HangerRail({ swap }: { swap: boolean }) {
  const ink = swap ? 'secondary' : 'primary';
  return (
    <XStack alignItems="center">
      <YStack width={6} height={6} backgroundColor={ink} />
      <YStack flex={1} height={2} backgroundColor="lineStrong" />
      <YStack width={6} height={6} backgroundColor={ink} />
    </XStack>
  );
}

// A tile in the wardrobe: it hangs from its row's rail by a hook and,
// pressed, swings about the hook (on the UI thread) before it settles.
export default function HangerTile(props: ChoiceProps) {
  const reduce = useReduceMotion();
  const swing = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }] }));
  const press = () => {
    if (!reduce) swing.value = withSequence(...SWING.map(([to, duration]) => withTiming(to, { duration })));
    props.onSelect();
  };
  return (
    <Animated.View style={[{ flex: 1, minWidth: 0, transformOrigin: 'top' }, style]}>
      <YStack alignSelf="center" width={1} height={HOOK} marginTop={-2} backgroundColor="lineStrong" />
      <MascotChoice {...props} onSelect={press} />
    </Animated.View>
  );
}
