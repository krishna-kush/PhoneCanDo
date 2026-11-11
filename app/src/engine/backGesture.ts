// Engine seam: the ONLY importer of the phonecando-back-gesture native
// module. Android's back gesture with its progress, for the app's own pages
// (ui/nav/useBackChain.ts). With worklet support, the module runs our
// gesture step on the UI thread itself and tells JS only what JS acts on.
// The module is optional: on an APK built before it, nothing here does
// anything and Back reaches React Native's BackHandler as before.
import { installOnUIRuntime } from 'expo';
import { createSerializable, getUIRuntimeHolder } from 'react-native-worklets';
import BackGesture, { type BackGestureEvent } from '../../modules/phonecando-back-gesture/src/PhoneCanDoBackGestureModule';

export type { BackGestureEvent };

let uiRuntimeReady = false;

/** Whether this build reports the gesture's progress (else Back arrives as one press). */
export function backGestureAvailable(): boolean {
  return BackGesture != null;
}

/** While on, Back comes to onBackGesture (and the step worklet) instead of React Native's BackHandler. */
export function setBackGestureEnabled(enabled: boolean): void {
  try {
    BackGesture?.setEnabled(enabled);
  } catch {
    // no activity yet: the next change asks again
  }
}

/**
 * Hands the module a worklet it runs on the UI thread for each start, move
 * and cancel (phase, progress 0..1, edge). False when this build cannot:
 * the events then carry every step to JS (`handled` false).
 */
export function setBackGestureStep(step: (phase: string, progress: number, edge: string) => void): boolean {
  if (!BackGesture?.setStepWorklet) return false;
  try {
    if (!uiRuntimeReady) {
      installOnUIRuntime(getUIRuntimeHolder());
      uiRuntimeReady = true;
    }
    BackGesture.setStepWorklet(createSerializable(step));
    return true;
  } catch {
    return false;
  }
}

export function onBackGesture(listener: (e: BackGestureEvent) => void): { remove: () => void } {
  if (!BackGesture) return { remove: () => {} };
  return BackGesture.addListener('phonecandoBackGesture', listener);
}
