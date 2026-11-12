// Engine seam: screens reach expo-local-authentication only through here
// (AGENTS.md: app/src/engine is the only importer of native modules).
import * as LocalAuthentication from 'expo-local-authentication';

/** passed; refused (cancelled or failed); or the phone has no screen lock, so Android shows no prompt. */
export type AuthResult = 'passed' | 'refused' | 'no_screen_lock';

/**
 * Asks for biometrics, falling back to the screen lock's PIN, pattern or
 * password. `strong`: only a fingerprint (strong biometrics) or the screen
 * lock count, which a phone-control unlock that is saved across restarts
 * needs (Android's Keystore accepts nothing weaker). Throws on errors.
 */
export async function confirmUser(
  promptMessage: string,
  opts: { strong?: boolean } = {},
): Promise<AuthResult> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage,
    cancelLabel: 'Cancel',
    biometricsSecurityLevel: opts.strong ? 'strong' : 'weak',
  });
  if (res.success) return 'passed';
  return res.error === 'not_enrolled' || res.error === 'passcode_not_set' ? 'no_screen_lock' : 'refused';
}

/** What to tell the user when the phone has no screen lock to confirm with. */
export const NO_SCREEN_LOCK =
  'Set a screen lock (PIN, pattern or password) in Android Settings first. Phone control unlocks only with it.';
