import { useEffect, useMemo, useState } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { PLAIN, type Look } from '../../../../../mascot/look.ts';
import { useReduceMotion } from '../useReduceMotion';
import FaceDrawing, { type HeartPlace, type Moving, PixelHeart } from './FaceDrawing';
import { faceLayout } from './layout';
import type { Mood } from './mood';
import {
  dropStyle,
  HEART_MS,
  HEART_RISE,
  heartStyle,
  LID,
  liftStyle,
  lidStyle,
  napAtMs,
  napPupilStyle,
  napZStyle,
  pupilStyle,
  REACTION,
  type Reaction,
  stepAtMs,
  Z_FLOAT_MS,
  Z_SHOWN,
  Z_WAIT_MS,
  zStyle,
} from './motion';

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
  /**
   * Played once, as it mounts or when it changes, between awake and
   * asleep (motion.ts's REACTION: the theme sweep's glare and startle,
   * Privacy's guard dozing off and waking); pass the reaction's `to`
   * mood with it, the face carries on as that mood once it is done.
   */
  reaction?: Reaction;
};

const LIVE: Moving = { View: Animated.View, Text: Animated.Text };

// Awake's blink, every [every] ms, again and again.
const blinking = (every: number) =>
  withRepeat(withSequence(withDelay(every, withTiming(0.15, { duration: 60 })), withTiming(1, { duration: 80 })), -1, false);

// The site's mascot A-01 as an agent's face, alive (FaceDrawing draws it):
// awake it blinks now and then, busy it looks about, asleep its eyes shut
// under a drifting "z", in trouble it squints under a "?", sweaty (the phone
// short of memory) it glances about, wide-eyed, while a drop runs down its
// brow, and happy its eyes close in a smile while a pixel heart floats up
// (or a few, one after another). Every motion is a Reanimated loop on the UI
// thread (no JS per step, no re-render), and none runs while it is `still`.
// A face that never moves (a picker's) is a StillFace: it sets none of this
// up.
export default function AgentFace({ mood, size = 24, mascot = PLAIN, hop = 0, still = false, hearts = 1, reaction }: Props) {
  const quiet = useReduceMotion() || still;
  // A reaction's first frame is already its `from` mood.
  const from = reaction ? REACTION[reaction].from : mood;
  const lid = useSharedValue<number>(LID[from]);
  const look = useSharedValue(0);
  const lift = useSharedValue(0);
  const drift = useSharedValue(0.5);
  const beat = useSharedValue(0);
  // A reaction's hand-over: 0 its pupils show, 1 its "z" does.
  const nap = useSharedValue(from === 'asleep' ? 1 : 0);
  const reacting = reaction != null && !quiet;
  // Each face keeps its own blink rhythm.
  const [blinkEvery] = useState(() => 2400 + Math.random() * 3600);

  const layout = useMemo(() => faceLayout(mascot, size), [mascot, size]);
  const { eyeW, mark, heartH } = layout;

  // The lid for the mood; awake blinks every few seconds.
  useEffect(() => {
    cancelAnimation(lid);
    lid.value = LID[mood];
    if (quiet || reacting || mood !== 'awake') return;
    lid.value = blinking(blinkEvery);
    return () => cancelAnimation(lid);
  }, [mood, quiet, reacting, blinkEvery, lid]);

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
    if (quiet || reacting || (mood !== 'asleep' && mood !== 'sweaty')) return;
    const run =
      mood === 'sweaty'
        ? withTiming(1, { duration: 1100, easing: Easing.in(Easing.quad) })
        : withTiming(1, { duration: Z_FLOAT_MS, easing: Easing.out(Easing.quad) });
    drift.value = withRepeat(withSequence(run, withDelay(Z_WAIT_MS, withTiming(0, { duration: 0 }))), -1, false);
    return () => cancelAnimation(drift);
  }, [mood, quiet, reacting, drift]);

  // A reaction, all on the UI thread from its first frame, so nothing on
  // the JS side can hold up a step: its lids' steps, the lean with them,
  // the hand-over between the pupils and the "z" (asleep's "z" floating
  // from where it is first in full, Z_SHOWN, at once), then its `to`
  // mood's own motion: awake blinks again, asleep's "z" keeps floating.
  useEffect(() => {
    if (!reaction || !reacting) return;
    const r = REACTION[reaction];
    const ease = Easing.inOut(Easing.quad);
    const wakes = r.from === 'asleep';
    const napAt = napAtMs(reaction);
    const last = r.steps.length - 1;
    const float = withTiming(1, { duration: Z_FLOAT_MS, easing: Easing.out(Easing.quad) });
    const reset = withDelay(Z_WAIT_MS, withTiming(0, { duration: 0 }));
    const zFromShown = withSequence(withTiming(Z_SHOWN, { duration: 0 }), float, reset, withRepeat(withSequence(float, reset), -1, false));
    const steps = r.steps.map((step, i) => withDelay(i === 0 ? 0 : r.steps[i - 1].hold, withTiming(step.lid, { duration: step.ms, easing: ease })));
    lid.value = LID[r.from];
    lid.value = withDelay(r.sleepMs, r.to === 'awake' ? withSequence(...steps, blinking(blinkEvery)) : withSequence(...steps));
    lift.value = withDelay(
      r.sleepMs,
      withSequence(
        withTiming(r.lean * size, { duration: r.steps[0].ms, easing: Easing.out(Easing.quad) }),
        withDelay(stepAtMs(reaction, last) - r.sleepMs - r.steps[0].ms, withTiming(0, { duration: r.steps[last].ms, easing: ease })),
      ),
    );
    nap.value = wakes ? 1 : 0;
    nap.value = withDelay(napAt, withTiming(wakes ? 0 : 1, { duration: r.napMs }));
    drift.value = 0;
    drift.value = wakes ? zFromShown : withDelay(napAt, zFromShown);
    return () => {
      cancelAnimation(lid);
      cancelAnimation(lift);
      cancelAnimation(nap);
      cancelAnimation(drift);
    };
  }, [reaction, reacting, size, blinkEvery, lid, lift, nap, drift]);

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

  const body = useAnimatedStyle(() => liftStyle(lift.value));
  const eye = useAnimatedStyle(() => lidStyle(lid.value));
  // Busy and sweaty, the pupils look as far as a gaze of 1 each way.
  const pupil = useAnimatedStyle(
    () => (reacting ? napPupilStyle(look.value, eyeW, nap.value) : pupilStyle(look.value, eyeW)),
    [eyeW, reacting],
  );
  const z = useAnimatedStyle(() => (reacting ? napZStyle(drift.value, mark, nap.value) : zStyle(drift.value, mark)), [mark, reacting]);
  const drop = useAnimatedStyle(() => dropStyle(drift.value, mark), [mark]);

  return (
    <FaceDrawing
      layout={layout}
      mood={reacting ? 'awake' : mood}
      handOver={reacting}
      moving={LIVE}
      motion={{ body, eye, pupil, z, drop }}
      hearts={quiet ? 1 : hearts}
      heart={(i, count, place) => <FloatingHeart beat={beat} phase={i / count} place={place} h={heartH} />}
    />
  );
}

// One heart of a happy face: rises off the head and fades, its turn
// [phase] of the way into the shared loop, then waits out the rest.
function FloatingHeart({ beat, phase, place, h }: { beat: SharedValue<number>; phase: number; place: HeartPlace; h: number }) {
  const style = useAnimatedStyle(() => heartStyle(beat.value, phase, h), [phase, h]);
  return <PixelHeart place={place} style={style} view={Animated.View} />;
}
