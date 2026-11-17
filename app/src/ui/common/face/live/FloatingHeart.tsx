import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { partWeight, type Sides, weighted } from '../change/parts';
import { type HeartPlace, PixelHeart } from '../FaceDrawing';
import { heartStyle } from '../motion';

type Props = {
  beat: SharedValue<number>;
  /** Its turn of the shared loop (0 to 1). */
  phase: number;
  place: HeartPlace;
  h: number;
  /** The hearts' weight across a change (change/parts.ts), and the hand-over. */
  sides: Sides;
  over: SharedValue<number>;
  at: number;
};

// One heart of a happy face: rises off the head and fades, its turn
// [phase] of the way into the shared loop, then waits out the rest; it
// fades with the smile as the face changes mood.
export default function FloatingHeart({ beat, phase, place, h, sides, over, at }: Props) {
  const style = useAnimatedStyle(() => weighted(heartStyle(beat.value, phase, h), partWeight(sides, over.value, at)), [phase, h, sides[0], sides[1], at]);
  return <PixelHeart place={place} style={style} view={Animated.View} />;
}
