import { useEffect, useState } from 'react';
import { cancelAnimation, Easing, type SharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { PARTS } from '../change/parts';
import type { Shift } from '../change/shift';
import { BLEND_MS, lookAround, type LookStep } from '../change/specs';
import { lookAtMs } from '../change/timing';
import type { Mood } from '../mood';
import { between, GLANCE, LOOK } from '../motion';

const ease = Easing.inOut(Easing.quad);

// Pupils' steps one after another (change/specs.ts's LookStep).
const looking = (steps: readonly LookStep[]) =>
  withSequence(...steps.map((s, i) => withDelay(i === 0 ? 0 : steps[i - 1].hold, withTiming(s.gaze, { duration: s.ms, easing: ease }))));

// A mood's own looking: awake glances to a side now and then (every
// [every] ms), the next one the other way; busy looks left and right;
// sweaty glances quickly, held; any other eases to where it rests them.
function ownLook(to: Mood, every: number) {
  const settle = withTiming(LOOK[to], { duration: BLEND_MS, easing: ease });
  if (to === 'awake') {
    const move = (gaze: number) => withTiming(gaze, { duration: GLANCE.moveMs, easing: ease });
    const glance = (side: number) => withSequence(withDelay(every, move(side * GLANCE.to)), withDelay(GLANCE.holdMs, move(LOOK.awake)));
    return withSequence(settle, withRepeat(withSequence(glance(-1), glance(1)), -1, false));
  }
  if (to === 'busy' || to === 'sweaty') {
    const [move, hold] = to === 'sweaty' ? [110, 700] : [280, 240];
    const step = (gaze: number) => withTiming(gaze, { duration: move, easing: ease });
    return withRepeat(withSequence(withDelay(hold, step(1)), withDelay(hold, step(-1))), -1, false);
  }
  return settle;
}

/**
 * A live face's pupils, on the UI thread: its mood's own looking
 * (ownLook), each face in its own glance rhythm. A change with a look of
 * its own (a tap waking it: who woke it?) plays that first, once the
 * pupils are in; a tap ([hop]) on a face already up looks around for who
 * tapped it the same way. Then its own looking carries on. At rest while
 * [quiet].
 */
export function useLook(shift: Shift, quiet: boolean, hop: number, look: SharedValue<number>) {
  const { to } = shift;
  const [every] = useState(() => between(GLANCE.everyMs, Math.random()));

  // Runs as the mood does; the change that brought it is this render's.
  useEffect(() => {
    cancelAnimation(look);
    if (quiet) {
      look.value = LOOK[to];
      return;
    }
    const c = shift.change;
    const own = ownLook(to, every);
    look.value = c?.look ? withSequence(withDelay(lookAtMs(c), looking(c.look)), own) : own;
    return () => cancelAnimation(look);
  }, [to, quiet, every, look]);

  // Runs only on a tap: one that woke it looks about in its change
  // already, and a face with no pupils (asleep, a smile) has none to look with.
  useEffect(() => {
    if (!hop || quiet || !PARTS[to].includes('pupils') || shift.change?.look) return;
    look.value = withSequence(looking(lookAround(LOOK[to])), ownLook(to, every));
  }, [hop, every, look]);
}
