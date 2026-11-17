// The update's install, the second of its two steps and the only one that
// stops anything: every agent's engine stops (stopForInstall), then the APK
// goes to Android's installer screen (openInstaller), which replaces this
// process when you confirm.
import { applicationId } from 'expo-application';
import type { File } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { isAnyEngineAlive, stopAllEngines } from '../engines';
import { canRequestPackageInstalls, markSelfUpdatePending } from '../runner';

const PACKAGE = applicationId ?? 'com.phonecando.app';

// Engines are children of this UID and can outlive an APK replace; stop
// every agent's engine, and everything they started, before the installer
// kills the app, so the new build never pairs with an old binary.
// stopAllEngines resolves once nothing tagged is left; the poll is a bound
// for a native side that answers early. The runs agents have going are
// kept: the new build offers to bring them back.
export async function stopForInstall(): Promise<void> {
  try {
    if (!isAnyEngineAlive()) return;
    await stopAllEngines(true);
    const deadline = Date.now() + 4000;
    while (isAnyEngineAlive() && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100));
    }
  } catch {
    // Native module absent: the installer still replaces the APK.
  }
}

// Hands the APK to Android's installer screen (ACTION_VIEW). Resolves when
// that screen closes; on success the process is replaced, so the caller only
// ever sees a cancel, and then tells the runner (engines.ts's
// updateCancelled) so the runs stopForInstall kept are offered back.
// Measured 2026-11-03 (docs/release/upgrade-test.md): Play Protect allows this when lite installs full, because the originating
// app is PhoneCanDo, not a browser or file manager. A session install that
// declares a non-file source was tried and dropped: it cannot clear the
// restricted-settings lock lite's own install already set
// (research/restricted-settings.md).
export async function openInstaller(apk: File): Promise<void> {
  console.log(`[phonecando-update] install apk=${apk.name}`);
  const uri = await getContentUriAsync(apk.uri);
  // The update receiver in the new build acts only on this mark
  // (PackageReplacedReceiver.kt).
  markSelfUpdatePending();
  const res = await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: uri,
    type: 'application/vnd.android.package-archive',
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    // Ask the installer for a result so a refusal is visible in logcat.
    extra: { 'android.intent.extra.RETURN_RESULT': true },
  });
  console.log(
    `[phonecando-update] intent result=${res.resultCode} extra=${JSON.stringify(res.extra ?? null)}`,
  );
}

// Android's "Install unknown apps" switch for PhoneCanDo. Checked before the
// installer screen: when it is off, the update box explains it and carries
// on by itself once the user comes back with it on.
export function canInstallUpdates(): boolean {
  return canRequestPackageInstalls();
}

export async function openInstallSettings(): Promise<void> {
  try {
    await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
      data: `package:${PACKAGE}`,
    });
  } catch {
    await IntentLauncher.startActivityAsync(
      IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
      { data: `package:${PACKAGE}` },
    );
  }
}
