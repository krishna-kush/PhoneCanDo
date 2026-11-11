import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { onBackGesture, setBackGestureEnabled, setBackGestureStep } from '../../engine/backGesture';
import { useAppStore } from '../../state/app';
import { webGoBack } from '../chat/webNavigation';
import { syncBackTarget } from './backTarget';
import { onBackGestureStep } from './backWorklet';
import { runBackInterceptor } from './interceptors';
import { gestureTarget } from './progress';

/**
 * What one Back does, in the order the screen shows it: a step inside a
 * page (interceptors.ts), the drawer, the top page, then the web UI's own
 * history on Home. False: nothing of ours is left, so the app goes.
 */
export function runBack(): boolean {
  if (runBackInterceptor()) return true;
  const app = useAppStore.getState();
  if (app.drawerOpen) {
    app.setDrawerOpen(false);
    return true;
  }
  if (app.back()) return true;
  return webGoBack();
}

// Android Back, registered once in App. While a page or the drawer is open,
// the back gesture comes with its progress (engine/backGesture.ts): the
// module runs backWorklet.ts on the UI thread, so the top page or the
// drawer follows the thumb even while JS is busy, and JS only hears the
// commit (and the start and cancel). Without that support, the same step
// runs here from each event. On Home, and on a build without the module,
// Back reaches React Native's BackHandler and runs the same chain in one
// step. Whether the gesture is ours follows the store by a subscription,
// not a hook: App (the whole tree) must not render again when the first
// page opens or the last one goes.
export function useBackChain() {
  useEffect(() => {
    const oursIn = (s: { pages: unknown[]; drawerOpen: boolean }) => s.pages.length > 0 || s.drawerOpen;
    let ours = oursIn(useAppStore.getState());
    setBackGestureEnabled(ours);
    return useAppStore.subscribe((s) => {
      const next = oursIn(s);
      if (next === ours) return;
      ours = next;
      setBackGestureEnabled(ours);
    });
  }, []);

  useEffect(() => {
    syncBackTarget();
    setBackGestureStep(onBackGestureStep);
    const gesture = onBackGesture((e) => {
      if (e.phase === 'commit') {
        gestureTarget.value = 0;
        if (!runBack()) setBackGestureEnabled(false);
        return;
      }
      if (!e.handled) onBackGestureStep(e.phase, e.progress, e.edge);
    });
    const press = BackHandler.addEventListener('hardwareBackPress', runBack);
    return () => {
      gesture.remove();
      press.remove();
    };
  }, []);
}
