import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { partWeight, type Sides, weighted } from '../change/parts';
import { ThoughtDot } from '../FaceDrawing';
import type { DotPlace } from '../layout';
import { dotStyle } from '../motion';

type Props = {
  beat: SharedValue<number>;
  /** Which dot, smallest first. */
  i: number;
  place: DotPlace;
  color: string;
  /** The dots' weight across a change (change/parts.ts), and the hand-over. */
  sides: Sides;
  over: SharedValue<number>;
  at: number;
};

// One of a thinking face's dots: pops in after the one before it on the
// shared beat, holds, and fades with the others; it fades with the mood
// as the face changes.
export default function FloatingDot({ beat, i, place, color, sides, over, at }: Props) {
  const style = useAnimatedStyle(
    () => weighted(dotStyle(beat.value, i, place.size), partWeight(sides, over.value, at)),
    [i, place.size, sides[0], sides[1], at],
  );
  return <ThoughtDot place={place} color={color} style={style} view={Animated.View} />;
}
