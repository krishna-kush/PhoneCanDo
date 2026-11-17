import { useEffect, useMemo, useState } from 'react';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { PLAIN, type Look } from '../../../../../mascot/look.ts';
import { useReduceMotion } from '../useReduceMotion';
import { partWeight, sidesOf, weighted } from './change/parts';
import type { Reaction } from './change/specs';
import FaceDrawing, { type Moving } from './FaceDrawing';
import { faceLayout } from './layout';
import FloatingHeart from './live/FloatingHeart';
import { useChangeMotion } from './live/useChangeMotion';
import { useMoodChange } from './live/useMoodChange';
import { useMoodLoops } from './live/useMoodLoops';
import type { Mood } from './mood';
import { dropStyle, LID, liftStyle, lidStyle, LOOK, pupilStyle, zStyle } from './motion';

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
   * A named change (change/specs.ts's REACTION: the theme sweep's glare
   * and startle) played as the face appears or when it is newly given,
   * instead of the one its mood change would pick; pass the reaction's
   * `to` mood with it.
   */
  reaction?: Reaction;
};

const LIVE: Moving = { View: Animated.View, Text: Animated.Text };

// The site's mascot A-01 as an agent's face, alive (FaceDrawing draws it):
// awake it blinks now and then, busy it looks about, asleep its eyes shut
// under a drifting "z", in trouble it squints under a "?", sweaty (the phone
// short of memory) it glances about, wide-eyed, while a drop runs down its
// brow, and happy its eyes close in a smile while a pixel heart floats up
// (or a few, one after another). Every change of mood is played, never
// snapped (change/: it dozes off, comes to, jolts awake at a tap, or blends),
// so a page only says the mood. Every motion is a Reanimated animation on
// the UI thread (no JS per step, no re-render), and none runs while it is
// `still`. A face that never moves (a picker's) is a StillFace: it sets
// none of this up.
export default function AgentFace({ mood, size = 24, mascot = PLAIN, hop = 0, still = false, hearts = 1, reaction }: Props) {
  const quiet = useReduceMotion() || still;
  const { shift, parts } = useMoodChange(mood, reaction, hop, quiet);
  const { from, to, at } = shift;
  const lid = useSharedValue<number>(LID[from]);
  const look = useSharedValue<number>(LOOK[from]);
  const lift = useSharedValue(0);
  const drift = useSharedValue(0.5);
  const beat = useSharedValue(0);
  // The hand-over between a change's two moods' parts (change/parts.ts).
  const over = useSharedValue<number>(at);
  // Each face keeps its own blink rhythm.
  const [blinkEvery] = useState(() => 2400 + Math.random() * 3600);

  const layout = useMemo(() => faceLayout(mascot, size), [mascot, size]);
  const { eyeW, mark, heartH } = layout;

  useChangeMotion(shift, size, quiet, { lid, lift, over });
  useMoodLoops(shift, quiet, blinkEvery, { lid, look, drift, beat });

  // A tap: a small hop with a landing bounce.
  useEffect(() => {
    if (!hop || quiet) return;
    lift.value = withSequence(
      withTiming(-size * 0.45, { duration: 140, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 320, easing: Easing.bounce }),
    );
  }, [hop, quiet, size, lift]);

  // Each part weighed between the change's two moods; at rest its mood's.
  const eyes = sidesOf('eyes', from, to);
  const pupils = sidesOf('pupils', from, to);
  const smiles = sidesOf('smile', from, to);
  const zs = sidesOf('z', from, to);
  const drops = sidesOf('drop', from, to);
  const queries = sidesOf('query', from, to);
  const body = useAnimatedStyle(() => liftStyle(lift.value));
  const eye = useAnimatedStyle(() => weighted(lidStyle(lid.value), partWeight(eyes, over.value, at)), [eyes[0], eyes[1], at]);
  // Busy and sweaty, the pupils look as far as a gaze of 1 each way.
  const pupil = useAnimatedStyle(() => weighted(pupilStyle(look.value, eyeW), partWeight(pupils, over.value, at)), [eyeW, pupils[0], pupils[1], at]);
  const smile = useAnimatedStyle(() => weighted({}, partWeight(smiles, over.value, at)), [smiles[0], smiles[1], at]);
  const z = useAnimatedStyle(() => weighted(zStyle(drift.value, mark), partWeight(zs, over.value, at)), [mark, zs[0], zs[1], at]);
  const drop = useAnimatedStyle(() => weighted(dropStyle(drift.value, mark), partWeight(drops, over.value, at)), [mark, drops[0], drops[1], at]);
  const query = useAnimatedStyle(() => weighted({}, partWeight(queries, over.value, at)), [queries[0], queries[1], at]);
  const heartSides = sidesOf('hearts', from, to);

  return (
    <FaceDrawing
      layout={layout}
      parts={parts}
      moving={LIVE}
      motion={{ body, eye, pupil, smile, z, drop, query }}
      hearts={quiet ? 1 : hearts}
      heart={(i, count, place) => (
        <FloatingHeart beat={beat} phase={i / count} place={place} h={heartH} sides={heartSides} over={over} at={at} />
      )}
    />
  );
}
