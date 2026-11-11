import { cancelAnimation, Easing, runOnJS, withTiming } from 'react-native-reanimated';
import { runOnUISync } from 'react-native-worklets';
import { COMMIT_MS, PRESS_MS, PUSH_MS } from './motion';
import {
  belowKey,
  commitProgress,
  motionId,
  motionKind,
  movingKey,
  previewing,
  pullEdge,
  pullProgress,
  pushProgress,
  topKey,
  underKey,
} from './progress';

// Material's emphasized decelerate: most of the way in the first third.
const EMPHASIZED = Easing.bezier(0.05, 0.7, 0.1, 1);
const STANDARD = Easing.bezier(0.2, 0, 0, 1);

/** Told on the JS thread when a motion ends: its id. */
export type MotionEnd = (id: number) => void;

// The stack's motion on the UI thread (motion.ts says how each part moves,
// progress.ts holds the state). Every step sets which layer plays which
// part in one synchronous call, so no frame shows half of a change.

/** A page is about to open over `under`: parts set, the slide waits for the page (startPush). */
export function beginPush(id: number, moving: string, under: string) {
  runOnUISync(
    (i: number, m: string, u: string) => {
      'worklet';
      motionId.value = i;
      pushProgress.value = 0;
      movingKey.value = m;
      underKey.value = u;
      motionKind.value = 1;
    },
    id,
    moving,
    under,
  );
}

/**
 * The new page is committed: its slide starts two frames on, on the UI
 * thread. The first frame is the one that mounts and draws the page (all of
 * its views at once), so the slide's clock starts after it and none of the
 * slide is skipped. A newer motion (a Back while the page was building)
 * wins: this one never starts. Handed over synchronously, not queued
 * behind the page's own effects (a page that refreshes its data on mount
 * would hold a queued start back).
 */
export function startPush(id: number, onStart: () => void, onEnd: MotionEnd) {
  runOnUISync(
    (i: number) => {
      'worklet';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (motionId.value !== i || motionKind.value !== 1) return;
          pushProgress.value = withTiming(1, { duration: PUSH_MS, easing: EMPHASIZED }, (finished) => {
            'worklet';
            if (finished) runOnJS(onEnd)(i);
          });
          runOnJS(onStart)();
        });
      });
    },
    id,
  );
}

/**
 * The top page `moving` goes and `under` comes back, starting now on the UI
 * thread: no React render comes first. A back gesture's preview carries on
 * from where the thumb left the page; a page still entering (Back while it
 * was building or sliding in) slides back out the way it came. Whether a
 * gesture ran is read on the UI thread, where the gesture set it.
 */
export function beginPop(id: number, moving: string, under: string, onEnd: MotionEnd) {
  runOnUISync(
    (i: number, m: string, u: string) => {
      'worklet';
      motionId.value = i;
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) runOnJS(onEnd)(i);
      };
      if (motionKind.value === 1 && movingKey.value === m && underKey.value === u && pushProgress.value < 1) {
        previewing.value = false;
        // Not in sight yet (its slide had not started): nothing to move.
        if (pushProgress.value === 0) {
          cancelAnimation(pushProgress);
          runOnJS(onEnd)(i);
          return;
        }
        pushProgress.value = withTiming(0, { duration: COMMIT_MS, easing: STANDARD }, done);
        return;
      }
      const gesture = previewing.value;
      if (!gesture) {
        cancelAnimation(pullProgress);
        pullProgress.value = 0;
        pullEdge.value = 1;
      }
      commitProgress.value = 0;
      movingKey.value = m;
      underKey.value = u;
      motionKind.value = 2;
      previewing.value = false;
      commitProgress.value = withTiming(
        1,
        { duration: gesture ? COMMIT_MS : PRESS_MS, easing: gesture ? STANDARD : EMPHASIZED },
        done,
      );
    },
    id,
    moving,
    under,
  );
}

/** At rest: `top` in front, `below` right under it (what a back gesture reveals). */
export function rest(top: string, below: string) {
  runOnUISync(
    (t: string, b: string) => {
      'worklet';
      topKey.value = t;
      belowKey.value = b;
      motionKind.value = 0;
    },
    top,
    below,
  );
}
