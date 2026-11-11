import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import tokens from '../../../../../theme/tokens.json';
import { useTheme } from '../globals';
import { logoOffset } from '../LogoMark';
import { useReduceMotion } from '../useReduceMotion';
import { poseScale, type Mood, type Pose } from './mood';

type Props = {
  mood: Mood;
  /** The body's side in dp (the mark's square). */
  size?: number;
  pose?: Pose;
  /** Bump it to make the face hop once (a tap). */
  hop?: number;
  /** Out of sight (a shut drawer, Home under a page): no blinking, looking or drifting. */
  still?: boolean;
};

const LID = { awake: 1, busy: 1, asleep: 0.15, oops: 0.45, sweaty: 1 } as const;

// The site's mascot A-01 as an agent's face: the logo's red square on its
// amber shadow, with two eyes (web/src/components/Mascot.astro, same
// proportions). Awake it blinks now and then, busy it looks about, asleep
// its eyes shut under a drifting "z", in trouble it squints under a "?",
// sweaty (the phone short of memory) it glances about, wide-eyed, while a
// drop runs down its brow.
// Every motion is a Reanimated loop on the UI thread (no JS per step, no
// re-render), and none runs while it is `still`. Decoration only (hidden
// from screen readers): rows say the state in words.
export default function AgentFace({ mood, size = 24, pose = 'square', hop = 0, still = false }: Props) {
  const t = useTheme();
  const quiet = useReduceMotion() || still;
  const lid = useSharedValue<number>(LID[mood]);
  const look = useSharedValue(0);
  const lift = useSharedValue(0);
  const drift = useSharedValue(0.5);
  // Each face keeps its own blink rhythm.
  const [blinkEvery] = useState(() => 2400 + Math.random() * 3600);

  const off = logoOffset(size);
  const { w, h } = poseScale(pose);
  const bodyW = Math.round(size * w);
  const bodyH = Math.round(size * h);
  // Room for every pose, so faces line up down a list.
  const box = Math.round(size * 1.3) + off;
  const left = Math.round((box - bodyW - off) / 2);
  const top = Math.round((box - bodyH - off) / 2);

  const eyeW = Math.max(2, Math.round(size * 0.25));
  const eyeH = Math.max(2, Math.round(size * 0.29));
  const gap = Math.max(1, Math.round(size * 0.08));
  const eyesLeft = Math.round((bodyW - eyeW * 2 - gap) / 2);
  const eyeTop = Math.round(bodyH * 0.29);
  // Down to the header's 16 (a 2dp pupil in a 4dp eye); below that, eyes only.
  const pupil = size >= 14 ? Math.max(2, Math.round(size * 0.125)) : 0;
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
  const pupilStyle = useAnimatedStyle(() => ({ transform: [{ translateX: look.value * pupil * 0.5 }] }), [pupil]);
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

  const eye = (x: number) => (
    <Animated.View
      style={[{ position: 'absolute', left: x, top: eyeTop, width: eyeW, height: eyeH, backgroundColor: t.onPrimary }, eyeStyle]}
    >
      {pupil > 0 && mood !== 'asleep' ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: Math.round((eyeW - pupil) / 2) + (mood === 'awake' ? Math.round(pupil * 0.4) : 0),
              top: Math.round(eyeH * 0.3),
              width: pupil,
              height: pupil,
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
      <Animated.View style={[{ position: 'absolute', left, top }, body]}>
        <View style={{ position: 'absolute', left: off, top: off, width: bodyW, height: bodyH, backgroundColor: t.secondary }} />
        <View style={{ width: bodyW, height: bodyH, backgroundColor: t.primary }}>
          {eye(eyesLeft)}
          {eye(eyesLeft + eyeW + gap)}
        </View>
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
      {mood === 'oops' ? (
        <Text style={{ position: 'absolute', right: 0, top: 0, fontFamily: 'GeistMono-Bold', fontSize: markSize, color: t.primary }}>
          ?
        </Text>
      ) : null}
    </View>
  );
}
