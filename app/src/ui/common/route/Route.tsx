import { useEffect, useRef, useState } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Line } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import { usePageActive } from '../../nav/pageActive';
import { hhmm } from '../../schedule/logic/clock';
import AgentFace from '../face/AgentFace';
import { useTheme } from '../globals';
import { useReduceMotion } from '../useReduceMotion';
import PlainText from '../PlainText';
import { stopsReached, trackingStops, waitingLine } from './copy';
import Parcel from './Parcel';
import { useGlide } from './useGlide';

// Room each end keeps for its mark (the depot, this phone).
const END = 18;
// The newest tracking lines shown.
const LOG_LINES = 3;
// How often A-01 hops where it stands while a download settles.
const HOP_MS = 700;

type Props = {
  /** waiting: offered, A-01 at the depot with the parcel · moving: downloading · paused: A-01 naps where it stopped · done: at the door. */
  stage: 'waiting' | 'moving' | 'paused' | 'done';
  /** The share downloaded, 0 to 1, while moving or paused; null while not known (A-01 keeps its last spot). */
  fraction?: number | null;
  /** Moving but no bytes coming yet (starting, re-reading what it has): A-01 hops where it stands. */
  working?: boolean;
  /** Where the parcel comes from: GitHub (our updates), Hugging Face, Docker Hub. */
  from?: string;
  /** In a row or a card: a smaller A-01 and no tracker's log (the row's own line says how far). */
  compact?: boolean;
};

// A download as a parcel run, offered, on its way and in as one trip: A-01
// waits at the depot with the parcel; downloading, it carries it down a
// dashed road to this phone, hopping every few percent, the road red
// behind it, a tick at each quarter, and (full size) a parcel tracker's
// log under it, each stop with the time it was reached, newest first;
// settling (no bytes yet, or none known), it hops where it stands; paused,
// it naps where it stopped; in, A-01 is pleased at the door. It never
// swaps for another bar: only real bytes move A-01. The update box, Settings → Updates, model
// and Linux downloads all draw it. Still while its page is covered.
export default function Route({ stage, fraction = null, working = false, from = 'GitHub', compact = false }: Props) {
  const t = useTheme();
  const active = usePageActive();
  const face = compact ? 16 : 20;
  const done = stage === 'done';
  const last = useRef(0);
  if (fraction != null) last.current = fraction;
  const f = done ? 1 : stage === 'waiting' ? 0 : (fraction ?? last.current);
  const settling = stage === 'moving' && (working || fraction == null);
  const inPlace = useHopsInPlace(settling && active);
  const glide = useGlide(f);
  const [road, setRoad] = useState(0);
  const stops = trackingStops(from);
  const reachedAt = useReachedAt(stage === 'moving' && !compact, fraction);
  const log = compact
    ? []
    : stage === 'waiting'
      ? [waitingLine(from)]
      : done
        ? [`${hhmm(Date.now())}  ${stops[stops.length - 1].line}`]
        : reachedAt.map((at, i) => `${hhmm(at)}  ${stops[i].line}`).reverse().slice(0, LOG_LINES);

  const trail = useAnimatedStyle(() => ({ width: glide.value * road }));
  const courier = useAnimatedStyle(() => ({ transform: [{ translateX: glide.value * road - face / 2 }] }));

  return (
    <YStack gap={compact ? '1' : '3'}>
      <XStack justifyContent="space-between">
        <PlainText fontFamily="mono" fontSize={9} letterSpacing={1.4} textTransform="uppercase" color="faint">
          {from}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={9} letterSpacing={1.4} textTransform="uppercase" color="faint">
          This phone
        </PlainText>
      </XStack>
      <YStack height={compact ? 38 : 48} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <YStack position="absolute" left={0} bottom={6} width={12} height={12} backgroundColor="lineStrong" />
        <YStack position="absolute" right={2} bottom={4} width={12} height={18} borderWidth={1.5} borderColor="primary" borderRadius={2} alignItems="center" justifyContent="flex-end" paddingBottom={2}>
          <YStack width={3} height={1} backgroundColor="primary" />
        </YStack>
        <YStack position="absolute" left={END} right={END} bottom={11} height={8} onLayout={(e) => setRoad(e.nativeEvent.layout.width)}>
          <Svg width="100%" height={1} style={{ position: 'absolute', top: 1 }}>
            <Line x1="0" x2="100%" y1={0.5} y2={0.5} stroke={t.lineStrong} strokeWidth={1} strokeDasharray="4 4" />
          </Svg>
          <Animated.View style={[{ position: 'absolute', left: 0, top: 0, height: 2, backgroundColor: t.primary }, trail]} />
          {[0.25, 0.5, 0.75].map((q) => (
            <YStack key={q} position="absolute" left={q * road} top={4} width={1} height={4} backgroundColor="lineStrong" />
          ))}
        </YStack>
        <Animated.View style={[{ position: 'absolute', left: END, bottom: 14, width: face, alignItems: 'center', gap: 1 }, courier]}>
          <Parcel size={done || compact ? 8 : 10} />
          <AgentFace
            mood={done ? 'happy' : stage === 'waiting' ? 'awake' : stage === 'paused' ? 'asleep' : 'busy'}
            size={face}
            hop={Math.floor(f * 25) + inPlace}
            hearts={done ? 2 : undefined}
            still={!active}
          />
        </Animated.View>
      </YStack>
      {log.length > 0 ? (
        <YStack gap="1">
          {log.map((line, row) => (
            <XStack key={line} alignItems="center" gap="2">
              <YStack width={6} height={6} backgroundColor={row === 0 ? 'primary' : 'lineStrong'} />
              <PlainText fontFamily="mono" fontSize={11} color={row === 0 ? 'fg' : 'faint'}>
                {line}
              </PlainText>
            </XStack>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}

/** A count that goes up every HOP_MS while [on], each one a hop where A-01 stands; none with animations off. */
function useHopsInPlace(on: boolean): number {
  const reduce = useReduceMotion();
  const [hops, setHops] = useState(0);
  useEffect(() => {
    if (!on || reduce) return;
    const id = setInterval(() => setHops((n) => n + 1), HOP_MS);
    return () => clearInterval(id);
  }, [on, reduce]);
  return hops;
}

/** When each tracking stop was first reached (epoch ms), in order; none while not tracked. */
function useReachedAt(tracked: boolean, fraction: number | null): number[] {
  const [at, setAt] = useState<number[]>([]);
  const reached = tracked ? stopsReached(fraction) : 0;
  useEffect(() => {
    setAt((prev) => (reached > prev.length ? [...prev, ...Array(reached - prev.length).fill(Date.now())] : prev));
  }, [reached]);
  return at;
}
