// Engine seam: screens reach expo-local-authentication only through here
// (AGENTS.md: app/src/engine is the only importer of native modules).
import * as LocalAuthentication from 'expo-local-authentication';

/** Asks for biometrics or the device PIN. False when the user cancels or fails; throws on errors. */
export async function confirmUser(promptMessage: string): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: 'Cancel' });
  return res.success;
}
