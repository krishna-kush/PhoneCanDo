import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { YStack } from 'tamagui';
import { useNow } from '../../common/time/useNow';
import { useReduceMotion } from '../../common/useReduceMotion';
import { handAngles } from '../logic/clockHands';
import { ringBuzz } from './feel';

/** The clock's body, and how far its amber shadow stands off. */
const S = 60;
const OFF = 4;
/** Inside its rim. */
const INNER = S - 4;
/** One rattle of a ring, and how many. */
const RATTLE_MS = 55;
const RATTLES = 7;
/** How often it ticks. */
const TICK_MS = 1000;

type Props = {
  /** Bump it to ring the clock once: it rattles on its feet, and the phone buzzes with each rattle. */
  rings: number;
  /** Out of sight: it stops ticking and never rattles. */
  still: boolean;
};

// The Schedules page's alarm clock: the logo's square on its amber shadow,
// two bells and two feet, telling the phone's time to the second. It ticks
// on its own (only it draws again each second) while in sight. Not
// pressable: the page around it rings it.
export default function AlarmClock({ rings, still }: Props) {
  const reduce = useReduceMotion();
  const now = useNow(!still, TICK_MS);
  const tilt = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.value}deg` }] }));
  const { hour, minute, second } = handAngles(now);

  useEffect(() => {
    if (!rings || still) return;
    // Felt even when it may not move.
    ringBuzz(RATTLE_MS, RATTLES);
    if (reduce) return;
    const swing = (to: number) => withTiming(to, { duration: RATTLE_MS, easing: Easing.inOut(Easing.quad) });
    tilt.value = withSequence(...Array.from({ length: RATTLES }, (_, i) => swing(i % 2 ? -7 : 7)), swing(0));
  }, [rings, reduce, still, tilt]);

  return (
    <Animated.View style={shake}>
      <YStack width={S + OFF} height={S + OFF + 14}>
        <Bell left={2} />
        <Bell left={S - 14} />
        <YStack position="absolute" left={OFF} top={10 + OFF} width={S} height={S} backgroundColor="secondary" />
        <YStack position="absolute" left={0} top={10} width={S} height={S} backgroundColor="bg" borderWidth={2} borderColor="primary">
          <Ticks />
          <Hand angle={hour} length={INNER * 0.25} width={3} color="fg" />
          <Hand angle={minute} length={INNER * 0.37} width={2} color="fg" />
          <Hand angle={second} length={INNER * 0.42} width={1} color="primary" />
          <YStack position="absolute" left={INNER / 2 - 2} top={INNER / 2 - 2} width={4} height={4} backgroundColor="primary" />
        </YStack>
        <YStack position="absolute" left={8} bottom={0} width={6} height={4} backgroundColor="primary" />
        <YStack position="absolute" left={S - 14} bottom={0} width={6} height={4} backgroundColor="primary" />
      </YStack>
    </Animated.View>
  );
}

// One bell on the clock's head.
function Bell({ left }: { left: number }) {
  return <YStack position="absolute" left={left} top={0} width={12} height={12} backgroundColor="secondary" borderWidth={2} borderColor="primary" />;
}

// The face's quarter marks: 12, 3, 6 and 9.
function Ticks() {
  const mid = INNER / 2 - 1;
  return (
    <>
      <YStack position="absolute" left={mid} top={3} width={2} height={5} backgroundColor="dim" />
      <YStack position="absolute" left={mid} bottom={3} width={2} height={5} backgroundColor="dim" />
      <YStack position="absolute" top={mid} left={3} width={5} height={2} backgroundColor="dim" />
      <YStack position="absolute" top={mid} right={3} width={5} height={2} backgroundColor="dim" />
    </>
  );
}

// A hand [angle]° round from 12: a bar twice its length centred on the
// face, its top half drawn, so it turns about the middle.
function Hand({ angle, length, width, color }: { angle: number; length: number; width: number; color: 'fg' | 'primary' }) {
  const mid = INNER / 2;
  return (
    <YStack
      position="absolute"
      left={mid - width / 2}
      top={mid - length}
      width={width}
      height={length * 2}
      style={{ transform: [{ rotate: `${angle}deg` }] }}
    >
      <YStack height={length} backgroundColor={color} />
    </YStack>
  );
}
