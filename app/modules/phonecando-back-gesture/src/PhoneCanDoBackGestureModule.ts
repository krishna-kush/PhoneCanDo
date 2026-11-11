import { NativeModule, requireOptionalNativeModule } from 'expo';

/**
 * One step of a back gesture; `progress` 0..1 across the swipe, `edge` the
 * side it started from. `handled`: the step worklet already ran it on the
 * UI thread (start, progress and cancel only; never sent for progress then).
 */
export type BackGestureEvent = {
  phase: 'start' | 'progress' | 'cancel' | 'commit';
  progress: number;
  edge: 'left' | 'right' | 'none';
  handled: boolean;
};

type BackGestureEvents = {
  phonecandoBackGesture(e: BackGestureEvent): void;
};

declare class PhoneCanDoBackGestureModule extends NativeModule<BackGestureEvents> {
  /** While on, Back comes here (start, progress, cancel, commit) instead of React Native's BackHandler. */
  setEnabled(enabled: boolean): void;
  /** A serializable worklet (createSerializable) run on the UI thread for start, progress and cancel; null stops it. */
  setStepWorklet?(worklet: unknown): void;
}

// Optional: an APK built before this module has none, and Back then goes
// through React Native's BackHandler alone (no progress, the same pages).
// Only loads the module; app/src/engine/backGesture.ts is its seam.
export default requireOptionalNativeModule<PhoneCanDoBackGestureModule>('PhoneCanDoBackGesture');
