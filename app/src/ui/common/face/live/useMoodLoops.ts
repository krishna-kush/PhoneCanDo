import { useEffect } from 'react';
import { cancelAnimation, Easing, type SharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { BLEND_MS } from '../change/specs';
import type { Shift } from '../change/shift';
import { handOverAtMs } from '../change/timing';
import type { Mood } from '../mood';
import { HEART_MS, LID, LOOK, REST, Z_FLOAT_MS, Z_SHOWN, Z_WAIT_MS } from '../motion';

type Values = { lid: SharedValue<number>; look: SharedValue<number>; drift: SharedValue<number>; beat: SharedValue<number> };

// Awake's blink, every [every] ms, again and again.
const blinking = (every: number) =>
  withRepeat(withSequence(withDelay(every, withTiming(0.15, { duration: 60 })), withTiming(1, { duration: 80 })), -1, false);

// What drifts on a mood: asleep's "z" floats up, sweaty's drop runs down.
const driftOf = (m: Mood) => (m === 'asleep' ? 'z' : m === 'sweaty' ? 'drop' : null);

/**
 * A live face's moods' own loops, on the UI thread: awake blinks now and
 * then, busy looks about, sweaty glances, the "z" or drop drifts, happy's
 * hearts float up. A loop runs while its mood is on either side of a
 * change, so a mark keeps moving as it fades; a mark a change brings in
 * starts as the marks hand over. The lids are the change's while one plays
 * (useChangeMotion). None runs while [quiet]: each rests (motion.ts's REST).
 */
export function useMoodLoops(shift: Shift, quiet: boolean, blinkEvery: number, { lid, look, drift, beat }: Values) {
  const { from, to } = shift;
  const resting = shift.change == null;

  // At rest the lid is the mood's; awake blinks every few seconds.
  useEffect(() => {
    if (!resting) return;
    cancelAnimation(lid);
    lid.value = LID[to];
    if (quiet || to !== 'awake') return;
    lid.value = blinking(blinkEvery);
    return () => cancelAnimation(lid);
  }, [to, resting, quiet, blinkEvery, lid]);

  // Busy: the pupils look left and right. Sweaty: quick glances, held.
  // Any other mood: they ease to where it rests them.
  useEffect(() => {
    cancelAnimation(look);
    if (quiet) {
      look.value = LOOK[to];
      return;
    }
    if (to !== 'busy' && to !== 'sweaty') {
      look.value = withTiming(LOOK[to], { duration: BLEND_MS, easing: Easing.inOut(Easing.quad) });
      return;
    }
    const [move, hold] = to === 'sweaty' ? [110, 700] : [280, 240];
    const step = (gaze: number) => withTiming(gaze, { duration: move, easing: Easing.inOut(Easing.quad) });
    look.value = withRepeat(withSequence(withDelay(hold, step(1)), withDelay(hold, step(-1))), -1, false);
    return () => cancelAnimation(look);
  }, [to, quiet, look]);

  // The "z" floats up and fades, again and again; the drop runs down.
  const drifting = driftOf(to) ?? driftOf(from);
  useEffect(() => {
    cancelAnimation(drift);
    drift.value = quiet ? REST.drift : 0;
    if (quiet || !drifting) return;
    const run =
      drifting === 'drop'
        ? withTiming(1, { duration: 1100, easing: Easing.in(Easing.quad) })
        : withTiming(1, { duration: Z_FLOAT_MS, easing: Easing.out(Easing.quad) });
    const reset = withDelay(Z_WAIT_MS, withTiming(0, { duration: 0 }));
    const loop = withRepeat(withSequence(run, reset), -1, false);
    const shown = drifting === 'z' ? withSequence(withTiming(Z_SHOWN, { duration: 0 }), run, reset, loop) : loop;
    // At rest it starts from nothing. In a change it is in view from its
    // start if the change leaves it (a face appearing mid-change, the
    // theme sweep's), or from the hand-over if the change brings it in;
    // the "z" from where it is first in full. The change is this render's:
    // the effect runs only as what drifts changes.
    const c = shift.change;
    drift.value = !c ? loop : driftOf(from) === drifting ? shown : withDelay(handOverAtMs(c), shown);
    return () => cancelAnimation(drift);
  }, [drifting, quiet, drift]);

  // Happy: one steady clock the hearts share, each a step behind the last.
  // Still, one heart holds halfway up.
  const hearty = from === 'happy' || to === 'happy';
  useEffect(() => {
    cancelAnimation(beat);
    beat.value = quiet ? REST.beat : 0;
    if (quiet || !hearty) return;
    beat.value = withRepeat(withTiming(1, { duration: HEART_MS, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(beat);
  }, [hearty, quiet, beat]);
}
