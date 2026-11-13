import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PLAIN, type Look } from '../../../../../mascot/look.ts';
import tokens from '../../../../../theme/tokens.json';
import { useTheme } from '../globals';
import { logoOffset } from '../LogoMark';
import { useReduceMotion } from '../useReduceMotion';
import { BOX, fitFace } from './fit';
import type { Mood } from './mood';
import WearMarks from './WearMarks';

type Props = {
  mood: Mood;
  /** The body's short side in dp (the mark's square). */
  size?: number;
  /** Its design, shape and inks (mascot/look.ts); A-01's own when left out. */
  mascot?: Look;
  /** Bump it to make the face hop once (a tap). */
  hop?: number;
  /** Out of sight (a shut drawer, Home under a page): no blinking, looking or drifting. */
  still?: boolean;
  /** Happy: how many hearts float up, one after another (1 to 3). */
  hearts?: number;
};

const LID = { awake: 1, busy: 1, asleep: 0.15, oops: 0.45, sweaty: 1, happy: 1 } as const;

// A pixel heart, row by row (happy), like the logo built from squares.
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
// One heart's loop, and the part of it spent rising (the rest is a pause).
const HEART_MS = 2300;
const HEART_RISE = 0.78;
// Each heart's sideways place, in heart widths from the first (up to three).
const HEART_SHIFT = [0, -0.75, -0.35];

// The site's mascot A-01 as an agent's face: the logo's red square on its
// amber shadow, with two eyes, in the agent's own mascot: its shape, which
// ink is in front and what it wears, laid out by the shared spec as the
// website's are (mascot/layout/figure.ts), drawn a little smaller when it
// would not fit its box. Awake it blinks now and then, busy it looks about, asleep
// its eyes shut under a drifting "z", in trouble it squints under a "?",
// sweaty (the phone short of memory) it glances about, wide-eyed, while a
// drop runs down its brow, and happy its eyes close in a smile while a
// pixel heart floats up (or a few, one after another).
// Every motion is a Reanimated loop on the UI thread (no JS per step, no
// re-render), and none runs while it is `still`. Decoration only (hidden
// from screen readers): rows say the state in words.
export default function AgentFace({ mood, size = 24, mascot = PLAIN, hop = 0, still = false, hearts = 1 }: Props) {
  const t = useTheme();
  const quiet = useReduceMotion() || still;
  const lid = useSharedValue<number>(LID[mood]);
  const look = useSharedValue(0);
  const lift = useSharedValue(0);
  const drift = useSharedValue(0.5);
  const beat = useSharedValue(0);
  // Each face keeps its own blink rhythm.
  const [blinkEvery] = useState(() => 2400 + Math.random() * 3600);

  // Room for every look, so faces line up down a list.
  const box = Math.round(size * BOX);
  const fit = useMemo(() => fitFace(mascot, size, box, logoOffset), [mascot, size, box]);
  const { figure: fig, dx, dy } = fit;
  const front = fig.front;
  const left = front.x + dx;
  const top = front.y + dy;
  const bodyW = front.w;
  const bodyH = front.h;
  const off = fit.offset;
  // The top of everything it draws: its hat's, if it wears one.
  const crown = fig.bounds.y + dy;

  const [eyeA, eyeB] = fig.eyes.map((e) => e.open);
  const eyeW = eyeA.w;
  const eyeH = eyeA.h;
  // Down to the header's 16 (a 2dp pupil in a 4dp eye); below that, eyes only.
  const pupilBox = size >= 14 ? fig.eyes[0].pupil : null;
  const pupilW = pupilBox?.w ?? 0;
  const markSize = Math.max(8, Math.round(size * 0.5));

  // The lid for the mood; awake blinks every few seconds.
  useEffect(() => {
    cancelAnimation(lid);
    lid.value = LID[mood];
    if (quiet || mood !== 'awake') return;
    lid.value = withRepeat(
      withSequence(withDelay(blinkEvery, withTiming(0.15, { duration: 60 })), withTiming(1, { duration: 80 })),
      -1,
      false,
    );
    return () => cancelAnimation(lid);
  }, [mood, quiet, blinkEvery, lid]);

  // Busy: the pupils look left and right. Sweaty: quick glances, held.
  useEffect(() => {
    cancelAnimation(look);
    look.value = 0;
    if (quiet || (mood !== 'busy' && mood !== 'sweaty')) return;
    const [move, hold] = mood === 'sweaty' ? [110, 700] : [280, 240];
    const step = (to: number) => withTiming(to, { duration: move, easing: Easing.inOut(Easing.quad) });
    look.value = -1;
    look.value = withRepeat(withSequence(withDelay(hold, step(1)), withDelay(hold, step(-1))), -1, false);
    return () => cancelAnimation(look);
  }, [mood, quiet, look]);

  // Asleep: a "z" floats up and fades, again and again. Sweaty: a drop
  // runs down, again and again.
  useEffect(() => {
    cancelAnimation(drift);
    drift.value = quiet ? 0.5 : 0;
    if (quiet || (mood !== 'asleep' && mood !== 'sweaty')) return;
    const run =
      mood === 'sweaty'
        ? withTiming(1, { duration: 1100, easing: Easing.in(Easing.quad) })
        : withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) });
    drift.value = withRepeat(withSequence(run, withDelay(500, withTiming(0, { duration: 0 }))), -1, false);
    return () => cancelAnimation(drift);
  }, [mood, quiet, drift]);

  // Happy: one steady clock the hearts share, each a step behind the last.
  // Still, one heart holds halfway up.
  useEffect(() => {
    cancelAnimation(beat);
    beat.value = quiet ? HEART_RISE / 2 : 0;
    if (quiet || mood !== 'happy') return;
    beat.value = withRepeat(withTiming(1, { duration: HEART_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(beat);
  }, [mood, quiet, beat]);

  // A tap: a small hop with a landing bounce.
  useEffect(() => {
    if (!hop || quiet) return;
    lift.value = withSequence(
      withTiming(-size * 0.45, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.bounce }),
    );
  }, [hop, quiet, size, lift]);

  const body = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.value }] }));
  // Busy and sweaty, the pupils look as far as a gaze of 1 each way (mascot/layout/eyes.ts).
  const pupilStyle = useAnimatedStyle(() => ({ transform: [{ translateX: look.value * eyeW * 0.22 }] }), [eyeW]);
  const zStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(drift.value, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
      transform: [{ translateY: interpolate(drift.value, [0, 1], [markSize * 0.4, -markSize * 0.4]) }],
    }),
    [markSize],
  );
  // The drop: a square with one sharp corner, turned so the corner points up.
  const drop = Math.max(3, Math.round(markSize * 0.5));
  const dropStyle = useAnimatedStyle(
    () => ({
      opacity: interpolate(drift.value, [0, 0.15, 0.75, 1], [0, 1, 1, 0]),
      transform: [{ translateY: interpolate(drift.value, [0, 1], [0, markSize * 0.8]) }, { rotate: '45deg' }],
    }),
    [markSize],
  );

  // Happy: each eye an upturned bracket, shut in a smile.
  const line = Math.max(1, Math.round(size * 0.07));
  const smileEye = (x: number, y: number) => (
    <View
      style={{
        position: 'absolute',
        left: x,
        top: y + Math.round(eyeH * 0.2),
        width: eyeW,
        height: Math.max(line * 2, Math.round(eyeH * 0.5)),
        borderColor: t.onPrimary,
        borderTopWidth: line,
        borderLeftWidth: line,
        borderRightWidth: line,
      }}
    />
  );

  // The hearts start low on the head's top-right corner, the later ones a
  // little further left.
  const cell = Math.max(1, Math.round(size * 0.07));
  const heartW = cell * HEART[0].length;
  const heartH = cell * HEART.length;
  const heartCount = quiet ? 1 : Math.max(1, Math.min(hearts, HEART_SHIFT.length));

  // Awake, its pupils rest a little to the right, as the site's do.
  const restX = mood === 'awake' ? eyeW * 0.11 : 0;
  const eye = (x: number, y: number) => (
    <Animated.View
      style={[{ position: 'absolute', left: x, top: y, width: eyeW, height: eyeH, backgroundColor: t.onPrimary }, eyeStyle]}
    >
      {pupilBox && mood !== 'asleep' ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: pupilBox.x - eyeA.x + restX,
              top: pupilBox.y - eyeA.y,
              width: pupilW,
              height: pupilBox.h,
              backgroundColor: tokens.dark.bg,
            },
            pupilStyle,
          ]}
        />
      ) : null}
    </Animated.View>
  );

  return (
    <View
      style={{ width: box, height: box, flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
    >
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0, width: box, height: box }, body]}>
        <View
          style={{
            position: 'absolute',
            left: fig.back.x + dx,
            top: fig.back.y + dy,
            width: bodyW,
            height: bodyH,
            backgroundColor: fig.back.ink === 'red' ? t.primary : t.secondary,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left,
            top,
            width: bodyW,
            height: bodyH,
            backgroundColor: front.ink === 'red' ? t.primary : t.secondary,
          }}
        >
          {mood === 'happy' ? smileEye(eyeA.x - front.x, eyeA.y - front.y) : eye(eyeA.x - front.x, eyeA.y - front.y)}
          {mood === 'happy' ? smileEye(eyeB.x - front.x, eyeB.y - front.y) : eye(eyeB.x - front.x, eyeB.y - front.y)}
        </View>
        <WearMarks marks={fig.marks} box={box} dx={dx} dy={dy} />
      </Animated.View>
      {mood === 'asleep' ? (
        <Animated.Text
          style={[{ position: 'absolute', right: 0, top: 0, fontFamily: 'GeistMono-Bold', fontSize: markSize, color: t.dim }, zStyle]}
        >
          z
        </Animated.Text>
      ) : null}
      {mood === 'sweaty' ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: left + bodyW - Math.round(drop * 0.6),
              top: top + Math.round(bodyH * 0.05),
              width: drop,
              height: drop,
              backgroundColor: t.dim,
              borderTopLeftRadius: 0,
              borderTopRightRadius: drop / 2,
              borderBottomLeftRadius: drop / 2,
              borderBottomRightRadius: drop / 2,
            },
            dropStyle,
          ]}
        />
      ) : null}
      {mood === 'happy'
        ? Array.from({ length: heartCount }, (_, i) => (
            <FloatingHeart
              key={i}
              beat={beat}
              phase={i / heartCount}
              left={left + bodyW + off - Math.round(heartW * (0.5 - HEART_SHIFT[i]))}
              top={crown - heartH + cell}
              cell={cell}
              color={t.primary}
            />
          ))
        : null}
      {mood === 'oops' ? (
        <Text style={{ position: 'absolute', right: 0, top: 0, fontFamily: 'GeistMono-Bold', fontSize: markSize, color: t.primary }}>
          ?
        </Text>
      ) : null}
    </View>
  );
}

// One heart of a happy face: rises off the head and fades, its turn
// [phase] of the way into the shared loop, then waits out the rest.
function FloatingHeart({
  beat,
  phase,
  left,
  top,
  cell,
  color,
}: {
  beat: SharedValue<number>;
  phase: number;
  left: number;
  top: number;
  cell: number;
  color: string;
}) {
  const w = cell * HEART[0].length;
  const h = cell * HEART.length;
  const style = useAnimatedStyle(() => {
    const p = (beat.value + phase) % 1;
    const life = Math.min(1, p / HEART_RISE);
    const eased = 1 - (1 - life) * (1 - life);
    return {
      opacity: p >= HEART_RISE ? 0 : interpolate(life, [0, 0.25, 0.8, 1], [0, 1, 1, 0]),
      transform: [{ translateY: interpolate(eased, [0, 1], [h * 0.4, -h * 0.8]) }],
    };
  }, [phase, h]);
  return (
    <Animated.View style={[{ position: 'absolute', left, top, width: w, height: h }, style]}>
      {HEART.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === 'X' ? (
            <View
              key={`${x}-${y}`}
              style={{ position: 'absolute', left: x * cell, top: y * cell, width: cell, height: cell, backgroundColor: color }}
            />
          ) : null,
        ),
      )}
    </Animated.View>
  );
}
