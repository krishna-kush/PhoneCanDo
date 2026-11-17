import { useEffect, useState } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { XStack, YStack } from 'tamagui';
import type { Look } from '../../../../../mascot/look.ts';
import PlainText from '../../common/PlainText';
import { useReduceMotion } from '../../common/useReduceMotion';
import { stageMark, STAGES, type SetupState } from '../logic/stage';
import { STAGE_SHORT } from '../copy';
import Runner, { RUNNER_W } from './Runner';

/** A level's segments, and a segment's height, in dp. */
const PER_LEVEL = 6;
const SEG_H = 12;
/** The room over the bar for the runner, and the flag's pole. */
const RUN_H = 58;
const POLE_H = 30;

type Props = { state: SetupState; at: number; mascot: Look };

// The arcade's track: a bar of four levels, a stage each, its segments
// lighting amber (each lands with a pop) as the setup gets past them, the
// agent running along its top to the red flag at the end, and the levels
// named under it, ticked once done.
export default function Track({ state, at, mascot }: Props) {
  const [width, setWidth] = useState(0);
  const total = STAGES.length * PER_LEVEL;
  const lit = Math.floor(at * total + 1e-6);
  return (
    <YStack gap="2" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <YStack height={RUN_H}>
        <YStack position="absolute" right={0} bottom={0} alignItems="flex-start">
          <XStack width={14} height={9} backgroundColor="primary" />
          <YStack width={2} height={POLE_H - 9} backgroundColor="lineStrong" />
        </YStack>
        {width > 0 ? <Runner state={state} x={at * Math.max(0, width - RUNNER_W - 8)} mascot={mascot} /> : null}
      </YStack>
      <XStack gap={4}>
        {STAGES.map((stage, level) => (
          <XStack key={stage} flex={1} gap={2}>
            {Array.from({ length: PER_LEVEL }, (_, i) => (
              <Segment key={i} lit={level * PER_LEVEL + i < lit} />
            ))}
          </XStack>
        ))}
      </XStack>
      <XStack gap={4}>
        {STAGES.map((stage, level) => {
          const mark = stageMark(level, state);
          return (
            <PlainText
              key={stage}
              flex={1}
              fontFamily="mono"
              fontSize={9}
              letterSpacing={1}
              textTransform="uppercase"
              numberOfLines={1}
              fontWeight={mark === 'now' ? '600' : '400'}
              color={mark === 'done' ? 'secondaryInk' : mark === 'now' ? (state.failed ? 'primary' : 'fg') : 'faint'}
            >
              {`${mark === 'done' ? '✓' : level + 1} ${STAGE_SHORT[level]}`}
            </PlainText>
          );
        })}
      </XStack>
    </YStack>
  );
}

// One segment of the bar: dark until lit, then amber, landing with a pop.
function Segment({ lit }: { lit: boolean }) {
  const reduce = useReduceMotion();
  const on = useSharedValue(lit ? 1 : 0);
  useEffect(() => {
    on.value = reduce
      ? lit
        ? 1
        : 0
      : lit
        ? withSpring(1, { damping: 8, stiffness: 300 })
        : withTiming(0, { duration: 120 });
  }, [lit, reduce, on]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, on.value * 2), transform: [{ scale: on.value }] }));
  return (
    <YStack flex={1} height={SEG_H} backgroundColor="line">
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }, style]}>
        <YStack flex={1} backgroundColor="secondary" />
      </Animated.View>
    </YStack>
  );
}
