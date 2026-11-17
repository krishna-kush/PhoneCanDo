import { useEffect } from 'react';
import { cancelAnimation, Easing, type SharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import type { Shift } from '../change/shift';
import { handOverAtMs, stepAtMs } from '../change/timing';

type Values = { lid: SharedValue<number>; lift: SharedValue<number>; over: SharedValue<number> };

/**
 * A live face's change of mood played on the UI thread from its first
 * frame, so nothing on the JS side can hold up a step: its lids' steps from
 * wherever they are, the lean with them, and the hand-over of its marks
 * (change/parts.ts's weights). At rest, or out of sight, the hand-over sits
 * at its end and plays nothing.
 */
export function useChangeMotion(shift: Shift, size: number, quiet: boolean, { lid, lift, over }: Values) {
  const { id, change: c, at } = shift;
  useEffect(() => {
    if (!c || quiet) {
      cancelAnimation(over);
      over.value = at;
      if (quiet) {
        cancelAnimation(lift);
        lift.value = 0;
      }
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    const steps = c.steps.map((step, i) => withDelay(i === 0 ? 0 : c.steps[i - 1].hold, withTiming(step.lid, { duration: step.ms, easing: ease })));
    lid.value = withDelay(c.sleepMs, steps.length === 1 ? steps[0] : withSequence(...steps));
    if (c.lean !== 0) {
      const last = c.steps.length - 1;
      lift.value = withDelay(
        c.sleepMs,
        withSequence(
          withTiming(c.lean * size, { duration: c.steps[0].ms, easing: Easing.out(Easing.quad) }),
          withDelay(Math.max(0, stepAtMs(c, last) - c.sleepMs - c.steps[0].ms), withTiming(0, { duration: c.steps[last].ms, easing: ease })),
        ),
      );
    }
    over.value = withDelay(handOverAtMs(c), withTiming(1 - at, { duration: c.handOverMs }));
    // Only a new change (its id) or going out of sight replays it: the
    // change and where its hand-over sits belong to that id.
  }, [id, quiet, size, lid, lift, over]);
}
