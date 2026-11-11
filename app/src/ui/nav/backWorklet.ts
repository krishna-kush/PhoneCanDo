import { Easing, withTiming } from 'react-native-reanimated';
import { CANCEL_MS } from './motion';
import { backTarget, drawerPull, gestureTarget, previewing, pullEdge, pullProgress } from './progress';

const STANDARD = Easing.bezier(0.2, 0, 0, 1);

/**
 * One step of Android's back gesture, on the UI thread: the back-gesture
 * module runs it there for the start, every move and a cancel (the commit
 * goes to JS, which pops the page or closes the drawer; the pop carries the
 * page on from where the thumb left it, stackMotion.ts beginPop). The top page
 * previews through the stack's state (motion.ts roleOf), so a start needs
 * no React render. Without
 * the module's worklet support it runs on the JS thread from the events.
 */
export function onBackGestureStep(phase: string, progress: number, edge: string) {
  'worklet';
  if (phase === 'start') {
    const target = backTarget.value;
    gestureTarget.value = target;
    if (target === 1) {
      pullEdge.value = edge === 'right' ? -1 : 1;
      pullProgress.value = 0;
      previewing.value = true;
    } else if (target === 2) {
      drawerPull.value = 0;
    }
    return;
  }
  const target = gestureTarget.value;
  if (phase === 'progress') {
    if (target === 1) pullProgress.value = progress;
    else if (target === 2) drawerPull.value = progress;
    return;
  }
  if (phase === 'cancel') {
    gestureTarget.value = 0;
    if (target === 1) {
      pullProgress.value = withTiming(0, { duration: CANCEL_MS, easing: STANDARD }, (finished) => {
        if (finished) previewing.value = false;
      });
    } else if (target === 2) {
      drawerPull.value = withTiming(0, { duration: CANCEL_MS, easing: STANDARD });
    }
  }
}
