// App access in words (engine/appAccess.ts has how it works): the question
// an agent's first reach into an app puts to you, as a permission slip, and
// Settings → Phone control → Apps, the answered apps and Allow all apps.
// Pure (zero RN imports).
import type { AppAccessApp, AppAccessState } from '../../engine/appAccess';
import { countApps, type AppTarget } from './logic/choices.ts';

/** What an app is called on the slip and the page: its label, else its package. */
export function appName(label: string | null | undefined, pkg: string | null | undefined): string {
  return label?.trim() || pkg?.trim() || 'an app';
}

// The question (AppAccessDialog)

/** After its desk, on the slip. */
export const ASKS = 'wants to use an app';

/** The question itself. */
export function questionLine(agentName: string, app: string): string {
  return `${agentName || 'An agent'} wants to use ${app}.`;
}

/** What each answer does, one line each, in the keys' order. */
export const ALWAYS_LINE = 'Always: saved for every agent. It needs your fingerprint or screen lock.';

export function justNowLine(agentName: string): string {
  return `Just now: only ${agentName || 'this agent'}, until it hands the phone back.`;
}

export const NO_LINE = 'No: blocked for every agent until you change it in Settings → Phone control → Apps.';

/** The slip's keys. */
export const KEY_ALWAYS = 'Always';
export const KEY_ONCE = 'Just now';
export const KEY_NO = 'No';

/** The fingerprint prompt's line for Always, here and in Settings. */
export function alwaysAuthTitle(app: string): string {
  return `Always allow ${app}`;
}

/** The fingerprint passed but Always did not save (no signature without a fresh confirm); the question stays. */
export const ALWAYS_REFUSED = "Always didn't save. Try it again and confirm right away, or pick Just now.";

/** The fingerprint prompt was cancelled or failed; the question stays. */
export const NOT_CONFIRMED_SLIP = 'Not confirmed, so nothing is saved. Try Always again, or pick another answer.';

/** Just now or No did not take while the question still waits. */
export const ANSWER_FAILED = "That answer didn't take. Try again.";

/** The fingerprint prompt's line for a block (No, or Block in Settings) while Allow all apps is on. */
export function blockAuthTitle(app: string): string {
  return `Block ${app}`;
}

/** A block went ahead unconfirmed while Allow all apps was on, so native turned it off. */
export const ALLOW_ALL_TURNED_OFF =
  "Allow all apps is off now: changing the blocked list while it's on needs your fingerprint or screen lock.";

/** The key that puts that notice away. */
export const KEY_OK = 'OK';

// Settings → Phone control → Apps

/** The row on Settings' Phone control panel, and the page's title. */
export const APPS_TITLE = 'Apps';

export const APPS_NOTE = 'Which apps agents may use. Each new app asks you first.';

/** How the row is set now: Allow all apps, then the answered apps by kind. */
export function appsNow(allowAll: boolean, apps: readonly AppAccessApp[]): string {
  const n = countApps(apps);
  const allowed = allowAll ? 'all apps allowed' : n.always > 0 ? `${n.always} always` : '';
  const blocked = n.blocked > 0 ? `${n.blocked} blocked` : '';
  return [allowed, blocked].filter((p) => p).join(' · ') || 'each app asks first';
}

export const PAGE_KICKER = 'settings · phone control';

export const PAGE_INTRO =
  'The first time agents reach an app, PhoneCanDo asks you: Always, Just now or No. Your answer counts for every agent. PhoneCanDo itself and your home screen never ask.';

/** The Allow all apps switch. */
export const ALLOW_ALL_TITLE = 'Allow all apps';

/** What the switch means now. */
export function allowAllNote(on: boolean): string {
  return on
    ? 'Agents use any app without asking you first.'
    : 'Off: each new app asks you first. Turning it on needs your fingerprint or screen lock.';
}

export const BLOCKED_STAY = 'Apps you blocked stay blocked either way.';

/** While Allow all apps is on, its signature covers the blocked list. */
export const ALLOW_ALL_GUARDS = "While it's on, changing the blocked list needs your fingerprint or screen lock.";

/** The lines under the switch's note: blocked apps stay blocked, and while on, what guards the blocked list. */
export function allowAllMore(on: boolean): string {
  return on ? `${BLOCKED_STAY} ${ALLOW_ALL_GUARDS}` : BLOCKED_STAY;
}

export const ALLOW_ALL_AUTH = 'Allow all apps';

/** An app's state on its row, its stamp and its door. */
export const STATE_WORD: Record<AppAccessState, string> = { always: 'always', blocked: 'blocked' };

/** An app's row, door or log line as a screen reader hears it. */
export function appSaid(label: string, state: AppAccessState): string {
  return `${label}, ${state === 'always' ? 'always allowed' : 'blocked'}`;
}

/** What a tap on an app does, said under every look's list. */
export const CHANGE_HINT = 'Tap an app to change it or have it asked again.';

/** The same, for a screen reader on each app. */
export const CHANGE_A11Y = 'Changes it or has it asked again';

/** The answered apps counted by kind ("2 always · 1 blocked"). */
export function tally(apps: readonly AppAccessApp[]): string {
  const n = countApps(apps);
  const parts = [n.always > 0 ? `${n.always} always` : '', n.blocked > 0 ? `${n.blocked} blocked` : ''];
  return parts.filter((p) => p).join(' · ') || 'no answers yet';
}

// The page: A-04 at the front desk, then the answered apps in two boxes

/** The two boxes. */
export const ALWAYS_GROUP = 'Always allowed';
export const BLOCKED_GROUP = 'Blocked';

/** A box with nobody in it. */
export const NONE_ALWAYS = 'None yet. Apps you answer Always land here.';
export const NONE_BLOCKED = 'None. Apps you answer No land here.';

export const DESK_GROUP = 'Front desk';

/** After A-04's serial, under its face. */
export const DESK_ROLE = 'front desk';

/** What A-04 says at the desk, by Allow all apps. */
export function deskLine(on: boolean): string {
  return on
    ? "Open house: agents walk into any app. The ones you blocked stay out."
    : 'Every new app knocks first and I ask you. Your answer counts for every agent.';
}

// An app's own pop-up, from its row

/** What the app's state means, under its name. */
export function stateLine(state: AppAccessState): string {
  return state === 'always' ? 'Every agent may use it without asking.' : 'Blocked for every agent.';
}

/** Each change's key. */
export const CHOICE_LABEL: Record<AppTarget, string> = { always: 'Always allow', blocked: 'Block', none: 'Ask again' };

export const ASK_AGAIN_LINE = 'Ask again: the next time an agent reaches it, PhoneCanDo asks you.';

export const KEY_CANCEL = 'Cancel';

/** The fingerprint prompt's line for a blocked app that will be asked again. */
export function unblockAuthTitle(app: string): string {
  return `Unblock ${app}`;
}

// What went wrong, on the page or the slip

export const NO_SCREEN_LOCK_LINE =
  'Set a screen lock (PIN, pattern or password) in Android Settings first. This needs it.';

export const NOT_CONFIRMED = 'Not confirmed, so nothing changed.';

export const SAVE_FAILED = "That didn't save. Try again.";

export function biometricError(message: string): string {
  return `Biometric error: ${message}`;
}
