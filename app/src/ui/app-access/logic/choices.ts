// What Settings → Phone control → Apps lets you do with each app, and which
// changes (there and on the app question) ask for your fingerprint first.
// Every change that lets agents in further asks (an agent with phone control
// could otherwise tap its own way in): Always and Allow all apps are signed
// natively, and a blocked app asked again is confirmed. While Allow all apps
// is on, its signature covers the blocked list too, so any change to that
// list takes the strong confirm: an unblock is refused without it, and a
// block asks first but never waits on it (native then turns Allow all off).
// Other changes that let agents in less never ask. Pure (zero RN imports).
import type { AppAccessApp, AppAccessState } from '../../../engine/appAccess';

/** Where an app can be or go: always, blocked, or off both lists (asked). */
export type AppTarget = AppAccessState | 'none';

/** The changes an app's pop-up offers, its main one first. */
export function choicesFor(state: AppAccessState): AppTarget[] {
  return state === 'always' ? ['blocked', 'none'] : ['always', 'none'];
}

/** Whether moving an app touches the blocked list. */
function touchesBlocked(from: AppTarget, to: AppTarget): boolean {
  return from !== to && (from === 'blocked' || to === 'blocked');
}

/** Whether moving an app asks for the fingerprint first (`allowAll`: Allow all apps is on). */
export function needsConfirm(from: AppTarget, to: AppTarget, allowAll: boolean): boolean {
  if (from === to) return false;
  return to === 'always' || (from === 'blocked' && to === 'none') || (allowAll && touchesBlocked(from, to));
}

/** Whether that confirm must be strong (a fingerprint or the screen lock): Android's Keystore signs only after one. */
export function strongConfirm(from: AppTarget, to: AppTarget, allowAll: boolean): boolean {
  if (from === to) return false;
  return to === 'always' || (allowAll && touchesBlocked(from, to));
}

/** A block goes ahead whatever the confirm says: letting agents in less never waits on a fingerprint. */
export function goesAheadAnyway(to: AppTarget): boolean {
  return to === 'blocked';
}

/** Turning Allow all apps on asks; off never does. */
export function allowAllNeedsConfirm(on: boolean): boolean {
  return on;
}

/** How many apps are answered each way. */
export function countApps(apps: readonly AppAccessApp[]): { always: number; blocked: number } {
  let always = 0;
  let blocked = 0;
  for (const a of apps) {
    if (a.state === 'always') always++;
    else if (a.state === 'blocked') blocked++;
  }
  return { always, blocked };
}
