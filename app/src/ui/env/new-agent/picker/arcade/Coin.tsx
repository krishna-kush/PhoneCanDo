import { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import { useReduceMotion } from '../../../../common/useReduceMotion';
import type { Coin as CoinId } from '../logic/coin';

/** One half-turn of a spin: face on to its back. */
const HALF_MS = 140;

type Props = {
  coin: CoinId;
  /** Its width, in dp. */
  size: number;
  /** Spins once each time this changes (another applicant picked); none: it lies still. */
  spin?: string;
};

// What an applicant costs to play, drawn in amber: a full coin for free
// play, a ring round a dot for a free tier, a ring for a local model, and
// for insert coin the cabinet's coin slot. A coin spins on its edge as its
// applicant is picked, on the UI thread; the slot never does.
export default function Coin({ coin, size, spin }: Props) {
  const reduce = useReduceMotion();
  const turn = useSharedValue(1);
  useEffect(() => {
    if (spin == null || reduce || coin === 'slot') return;
    turn.value = withRepeat(withSequence(withTiming(-1, { duration: HALF_MS }), withTiming(1, { duration: HALF_MS })), 2);
  }, [spin, reduce, coin, turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: turn.value }] }));
  if (coin === 'slot') return <Slot size={size} />;
  const ring = Math.max(1.5, size / 6);
  return (
    <Animated.View style={style}>
      <YStack
        width={size}
        height={size}
        borderRadius={size / 2}
        borderWidth={coin === 'play' ? 0 : ring}
        borderColor="secondary"
        backgroundColor={coin === 'play' ? 'secondary' : 'transparent'}
        alignItems="center"
        justifyContent="center"
      >
        {coin === 'tier' ? <YStack width={size / 3} height={size / 3} borderRadius={size / 6} backgroundColor="secondary" /> : null}
      </YStack>
    </Animated.View>
  );
}

// A cabinet's coin slot: a hairline plate with the slit down its middle.
function Slot({ size }: { size: number }) {
  return (
    <YStack width={size} height={size} borderWidth={1} borderColor="lineStrong" alignItems="center" justifyContent="center">
      <YStack width={2} height={size * 0.6} backgroundColor="faint" />
    </YStack>
  );
}
