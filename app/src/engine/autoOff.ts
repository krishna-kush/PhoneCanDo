// Auto off (full builds; native autooff/): payment and bank apps refuse to
// open while an accessibility service Google has not reviewed is on, ours
// included, so with Auto off on the service turns itself off once
// PhoneCanDo has been out of sight and no agent has wanted the screen for a
// little while. Only the user turns it back on, in Android's Accessibility
// settings. Kept natively, so the service holds to it with no JS around,
// as is its one-time offer, due from the switch's first turn-on on this
// install. A native build from before it reads as off and cannot save.
import { isRunnerAvailable, nativeRunner } from './runner';

/** Whether this build has Auto off at all. */
export function canAutoOff(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return typeof nativeRunner().setAutoOff === 'function';
  } catch {
    return false;
  }
}

/** The switch; false where the module or the method is absent. */
export function autoOff(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return nativeRunner().getAutoOff?.() === true;
  } catch {
    return false;
  }
}

/** Saves the switch and returns it as kept; null when this build cannot keep it. */
export function setAutoOff(on: boolean): boolean | null {
  if (!isRunnerAvailable()) return null;
  try {
    const m = nativeRunner();
    return typeof m.setAutoOff === 'function' ? m.setAutoOff(on) : null;
  } catch {
    return null;
  }
}

/** Auto off turned the service off and it has not run since. */
export function wasAutoOff(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return nativeRunner().wasAutoOff?.() === true;
  } catch {
    return false;
  }
}

/** The switch came on for the first time on this install and the offer is not answered yet. */
export function autoOffOfferDue(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return nativeRunner().autoOffOfferDue?.() === true;
  } catch {
    return false;
  }
}

/** Answers the offer without changing Auto off (setAutoOff answers it too). */
export function dropAutoOffOffer(): void {
  if (!isRunnerAvailable()) return;
  try {
    nativeRunner().dropAutoOffOffer?.();
  } catch {
    // answered again at the next offer's key
  }
}
