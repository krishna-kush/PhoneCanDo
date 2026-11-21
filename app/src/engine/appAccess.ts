// App access (full builds; native, in the runner's bridge): the first time
// agents reach an app on the phone, the user is asked. Always is saved for
// every agent and signed by a Keystore key that signs only right after the
// user's biometric, so JS confirms the user first (engine/auth.ts) and calls
// straight after; Just now is the asking agent's alone, until it hands the
// phone back; No blocks the app for every agent until changed in Settings.
// Allow all apps lets every app through without asking, except the blocked
// ones. Each app's own icon shows beside its name. Lite, play and native
// builds from before it have none of this: the list reads empty, nothing
// saves and no icon draws.
import { isRunnerAvailable, nativeRunner } from './runner';

/** An answered app, for every agent: always allowed, or blocked. */
export type AppAccessState = 'always' | 'blocked';

/** The user's answer to an app prompt. */
export type AppAnswer = 'always' | 'once' | 'no';

export type AppAccessApp = { package: string; label: string; state: AppAccessState };

/** The Allow all apps switch and every answered app, sorted by label. */
export type AppAccessList = { allowAll: boolean; apps: AppAccessApp[] };

const EMPTY: AppAccessList = { allowAll: false, apps: [] };

/** Whether this build asks before agents use an app at all. */
export function canAppAccess(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return typeof nativeRunner().appAccessList === 'function';
  } catch {
    return false;
  }
}

// What native sends, checked: an entry without a package or with a state we
// don't know is dropped; a missing label reads as the package.
function asList(value: unknown): AppAccessList {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
  if (!raw) return EMPTY;
  const apps: AppAccessApp[] = [];
  for (const item of Array.isArray(raw.apps) ? raw.apps : []) {
    const a = item && typeof item === 'object' ? (item as Record<string, unknown>) : null;
    const pkg = typeof a?.package === 'string' ? a.package : '';
    const state = a?.state;
    if (!pkg || (state !== 'always' && state !== 'blocked')) continue;
    apps.push({ package: pkg, label: typeof a?.label === 'string' && a.label ? a.label : pkg, state });
  }
  return { allowAll: raw.allowAll === true, apps };
}

/** The list as native keeps it; empty where this build has none. */
export function appAccessList(): AppAccessList {
  if (!isRunnerAvailable()) return EMPTY;
  try {
    const m = nativeRunner();
    return typeof m.appAccessList === 'function' ? asList(m.appAccessList()) : EMPTY;
  } catch {
    return EMPTY;
  }
}

/**
 * Answers one app prompt; "always" right after the user's biometric. False
 * when it did not take: the signature was refused (no recent biometric), the
 * prompt is gone, or this build has no app access.
 */
export function resolveAppAccess(requestId: string, answer: AppAnswer): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    const m = nativeRunner();
    return typeof m.resolveAppAccess === 'function' ? m.resolveAppAccess(requestId, answer) === true : false;
  } catch {
    return false;
  }
}

/** Sets one app from Settings: always (right after biometrics), blocked, or none (it is asked again). False when it did not stick. */
export function setAppAccess(pkg: string, state: AppAccessState | 'none'): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    const m = nativeRunner();
    return typeof m.setAppAccess === 'function' ? m.setAppAccess(pkg, state) === true : false;
  } catch {
    return false;
  }
}

/** Saves Allow all apps (on right after biometrics) and returns it as kept; null when this build cannot keep it. */
export function setAllowAllApps(on: boolean): boolean | null {
  if (!isRunnerAvailable()) return null;
  try {
    const m = nativeRunner();
    return typeof m.setAllowAllApps === 'function' ? m.setAllowAllApps(on) === true : null;
  } catch {
    return null;
  }
}

/**
 * The app's launcher icon, drawn `sizePx` square by native, as the file://
 * URI of a PNG in the app's cache; null when Android hides the app, it has
 * no icon of its own, or this build draws none (lite, play, older native
 * builds).
 */
export async function appIcon(pkg: string, sizePx: number): Promise<string | null> {
  if (!pkg || !isRunnerAvailable()) return null;
  try {
    const m = nativeRunner();
    if (typeof m.appIcon !== 'function') return null;
    const uri: unknown = await m.appIcon(pkg, Math.round(sizePx));
    return typeof uri === 'string' && uri.startsWith('file://') ? uri : null;
  } catch {
    return null;
  }
}
