import { useEffect } from 'react';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import Plate from '../../common/Plate';
import { useReduceMotion } from '../../common/useReduceMotion';
import { SIGN } from './copy';

/** How long the tired letter stays lit between flickers. */
const LIT_MS = 2800;

// The sign in the empty office's window: NOW HIRING on two cords, in the
// brand's red on the hard amber shadow, one letter flickering now and then
// like a tired neon's. Still under "Remove animations" and while [still]
// (Home covered).
export default function HiringSign({ still }: { still: boolean }) {
  return (
    <YStack alignItems="center">
      <XStack width={170} justifyContent="space-between">
        <YStack width={1} height={26} backgroundColor="lineStrong" />
        <YStack width={1} height={26} backgroundColor="lineStrong" />
      </XStack>
      <Plate padding="3" alignItems="center" gap="1">
        <PlainText fontFamily="mono" fontSize={12} letterSpacing={3} textTransform="uppercase" color="secondaryInk">
          {SIGN.now}
        </PlainText>
        <XStack>
          {[...SIGN.hiring.toUpperCase()].map((letter, i) => (
            <Letter key={`${i}${letter}`} letter={letter} flickers={i === SIGN.flicker} still={still} />
          ))}
        </XStack>
      </Plate>
    </YStack>
  );
}

function Letter({ letter, flickers, still }: { letter: string; flickers: boolean; still: boolean }) {
  const reduce = useReduceMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (!flickers || reduce || still) {
      cancelAnimation(glow);
      glow.value = 1;
      return;
    }
    glow.value = withRepeat(
      withSequence(
        withDelay(LIT_MS, withTiming(0.2, { duration: 50 })),
        withTiming(1, { duration: 60 }),
        withTiming(0.35, { duration: 40 }),
        withTiming(1, { duration: 90 }),
      ),
      -1,
    );
    return () => cancelAnimation(glow);
  }, [flickers, reduce, still, glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View style={style}>
      <PlainText fontFamily="mono" fontSize={34} fontWeight="700" letterSpacing={2} color="primary">
        {letter}
      </PlainText>
    </Animated.View>
  );
}
