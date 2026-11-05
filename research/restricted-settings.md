# Android restricted settings (accessibility lock) — what the app can know

Question (2026-11-04): the guided accessibility setup for sideloaded installs
could not tell whether the app was under Android's restricted-settings lock,
whether to send the user to App info, or whether the user had cleared it. Is
that fixable? Answered from the AOSP 13–16 sources (LineageOS mirrors of
`frameworks/base`, `packages/apps/Settings`, `packages/modules/Permission`:
branches `lineage-20.0` = 13, `21.0` = 14, `22.2` = 15, `23.0` = 16). What
graduated into code lives in `RestrictedSettings.kt`; the facts below are the
evidence.

## The mechanism

- One app op holds the lock: `OP_ACCESS_RESTRICTED_SETTINGS`
  (`android:access_restricted_settings`). Modes: `deny` (ERRORED) = locked,
  `ignore` (IGNORED) = locked and the notice was shown, `allow` = cleared.
  Android 16 adds `default` = decide lazily (`AppOpsManager.java`, the
  `AppOpInfo` for the op: `setDefaultMode(MODE_DEFAULT)` on 16, `MODE_ALLOWED`
  on 13–15; `setRestrictRead(true)` on all).
- The lock is applied by the package manager at install time iff the
  installer declared `PACKAGE_SOURCE_LOCAL_FILE` (3) or
  `PACKAGE_SOURCE_DOWNLOADED_FILE` (4):
  `InstallPackageHelper.enableRestrictedSettings` (13, 14) /
  `setAccessRestrictedSettingsMode(…, MODE_ERRORED)` (15, 16). On 14+ it runs
  only for `firstUserIds` (a first install for that user), so updates never
  re-lock; on 13 it runs on every install from a file. The mode is an app op
  on the package, so it also survives updates (and `appops reset`, via
  `setDisableReset`): an app first installed from a file stays locked through
  later updates from any source until the user allows it. In PhoneCanDo's
  flow the lock is therefore set when lite is first opened from Files, and
  full inherits it through the in-place update; the 2026-11-03 upgrade test
  saw `deny` on full right after that update, which Android 16 would not have
  set itself. Nothing in this code,
  in the ECM service or in Settings checks `FLAG_DEBUGGABLE`: the project's
  debug builds are exempt because `pm install` defaults to
  `PACKAGE_SOURCE_OTHER` (`PackageManagerShellCommand`, 13+), not because they
  are debuggable.
- The Settings toggle: `RestrictedPreferenceHelper` (Settings, accessibility)
  refuses the switch when the mode is not `allow` (16 also accepts
  `default`), and shows the notice through SettingsLib
  `RestrictedLockUtilsInternal.sendShowRestrictedSettingDialogIntent`
  (`android.settings.SHOW_RESTRICTED_SETTING_DIALOG` with
  `EXTRA_PACKAGE_NAME` + `EXTRA_UID`). The handler,
  `com.android.settings.ActionDisabledByAppOpsDialog`, shows the dialog and
  sets the op to `ignore` for the package named in the intent, unconditionally.
  It is `exported="false"` on 13 and `exported="true"` with no permission on
  14, 15 and 16 (`Settings/AndroidManifest.xml`).
- App info: `AppInfoDashboardFragment.shouldShowAccessRestrictedSettings` shows
  "Allow restricted settings" iff the mode is `ignore` (13–16 legacy path) or
  `isClearRestrictionAllowed` (ECM path, same state); choosing it sets `allow`
  after the user confirms with the screen lock.
- Android 15/16 Enhanced Confirmation Mode (`EnhancedConfirmationService`,
  Permission module) wraps the same op. When its two aconfig flags are on
  (`enhanced_confirmation_mode_apis_enabled` and `extend_ecm_to_all_settings`)
  the install sets `default` and `isPackageEcmGuarded` decides lazily:
  allowlisted or preinstalled package → not guarded; explicit state wins;
  `LOCAL_FILE`/`DOWNLOADED_FILE` → guarded; otherwise guarded unless the
  installer is a system app, an allowlisted installer, or the device declares
  no `<enhanced-confirmation-trusted-installer>` at all (AOSP ships an empty
  `frameworks/base/data/etc/enhanced-confirmation.xml`; OEM/Google builds may
  add entries). The Moto G96 (Android 16) in `docs/release/upgrade-test.md`
  showed `deny` right after the lite→full install, i.e. the legacy
  install-time path, so those flags were off there. Android 16 also refuses
  the switch during a call from an unknown number
  (`UNTRUSTED_CALL_RESTRICTED_SETTINGS` includes `BIND_ACCESSIBILITY_SERVICE`).
- `packageSource=3` in the upgrade-test log is `PACKAGE_SOURCE_LOCAL_FILE`
  (`PackageInstaller.java`: UNSPECIFIED 0, OTHER 1, STORE 2, LOCAL_FILE 3,
  DOWNLOADED_FILE 4), which the system installer screen assigns to an
  `ACTION_VIEW` install. Either file value locks.

## What a normal app cannot do (every version)

- Read the op: `AppOpsService.verifyIncomingOp` throws `SecurityException`
  for a restricted-read op unless the caller holds `MANAGE_APPOPS`,
  `GET_APP_OPS_STATS` or `MANAGE_APP_OPS_MODES` (all signature/privileged).
  `checkOp`, `noteOp`, `unsafeCheckOpRaw`, `getOpsForPackage` all route there.
  Confirmed on device (`runner.md`).
- Watch the op: `shouldIgnoreCallback` drops mode-changed, noted, started and
  active callbacks for restricted-read ops when the watcher lacks
  `MANAGE_APPOPS` ("watcher should not use this to signal if the value is
  changed").
- Use ECM: `EnhancedConfirmationManager` is `@SystemApi`; `isRestricted`,
  `isClearRestrictionAllowed`, `clearRestriction` and
  `setClearRestrictionAllowed` all require
  `MANAGE_ENHANCED_CONFIRMATION_STATES` (`signature|installer`). The 15+
  dialog in PermissionController (`EnhancedConfirmationDialogActivity`) is
  exported but guarded by that permission.
- Open its own service page: `ACTION_ACCESSIBILITY_DETAILS_SETTINGS` needs
  `OPEN_ACCESSIBILITY_DETAILS_SETTINGS` (`signature|installer`). The
  fragment-args extras that scroll the list to PhoneCanDo remain the best
  available.
- Clear the lock or open the ⋮ menu for the user.

So the lock state and the user's progress through App info are not observable.
The only hard end signal is the service: `enabled_accessibility_services`
(Secure settings, readable by anyone) the moment the switch is flipped, then
`onServiceConnected`.

## What the app does with this (in code)

1. The flow is a constant, not a reading. `RESTRICTED_FLOW` in
   `app/src/ui/accessibility/guide.ts` (`true`) runs a three-step guide, all
   steps visible with the current one spelled out (`StepList.tsx`): 1 shows
   Android's "Restricted setting" note, 2 opens App info for "Allow
   restricted settings", 3 opens Accessibility for the switch. Every release
   install reaches users as a file (lite from the site, full through lite's
   in-place update), so it is locked. `false` shows the plain switch with the
   guide one tap away, at step 2. The guide only runs on Android 13+ (API 33).
2. Step 1 on Android 14+ starts `android.settings.SHOW_RESTRICTED_SETTING_DIALOG`
   for our own package (`ActionDisabledByAppOpsDialog`, exported without a
   permission; 13 keeps it private). It shows the note over the app and sets
   the acknowledged state unconditionally, which adds the App info item, so
   the user never has to find PhoneCanDo in the Accessibility list. It has no
   guard: on an app that was not locked, or was already allowed, it locks it,
   and step 2, which always follows, allows it again (one extra
   confirmation). An earlier guard needed the first install's source, which
   the app cannot see for a full installed by an older lite, and on the test
   phone it declined and left App info without the item. Verified on the
   Moto G96, Android 16, 2026-11-04, with `am start` for the dev package:
   `default` → `ignore`. Without it (Android 13, an OEM that guards it, or a
   note that did not appear) step 1 opens Accessibility so the user taps
   PhoneCanDo, which shows the same note.
3. Hard end signals: PhoneCanDo in `enabled_accessibility_services` (written
   the moment the switch turns on) and `onServiceConnected`. A service that
   ran once on this install also proves the switch was allowed, so the guide
   is skipped after that (prefs survive updates and die with an uninstall,
   like the lock). On Android 13 a later update from a file voids that
   memory, because 13 locks again on every file install.
4. The install-source rule is only the bridge's guess for its `restricted`
   field when the app gives no answer in time; the guide never depends on it.
5. The bridge waits up to four minutes for the service while the user
   follows the guide, so the agent continues by itself when the switch turns
   on; "Not now" in the dialog ends the wait at once. The cap stays under
   five minutes, where HTTP clients stop waiting for a response.

## On-device checks still owed

Lite's updater installs the full build published on GitHub, not `dist/`, so
the lite→full flow cannot carry a local build. Test a local full by
installing it over adb with a file source declared, which applies the lock
exactly as a first install from Files does (`pm install --package-source`
exists on the Moto's Android 16; the Android 13 shell has no such option).
This wipes the app's data:

```
adb uninstall com.phonecando.app
adb push dist/full/phonecando-<ver>-full-arm64.apk /data/local/tmp/full.apk
adb shell pm install --package-source 3 /data/local/tmp/full.apk
```

Then, on the Moto G96 (Android 16), checking
`adb shell appops get com.phonecando.app ACCESS_RESTRICTED_SETTINGS` along
the way:

1. Start: `deny` or `default`. Settings → Phone control shows the three
   steps, step 1 current. "1 · Show Android's check": the "Restricted
   setting" note appears over the app; OK; `ignore`; the guide is on step 2.
2. "2 · Open app info": ⋮ shows "Allow restricted settings"; allow it with
   the screen lock; `allow`. Back in the app the guide is on step 3.
3. "3 · Open accessibility": PhoneCanDo turns on; the card says
   "Accessibility service: on" and the guide disappears.
4. Update in place with the same command plus `-r`: the switch stays on and
   no guide shows.

## Avoiding the lock at the source (tried, removed)

Idea: install full through PhoneCanDo's own `PackageInstaller.Session` with
`setPackageSource(PACKAGE_SOURCE_OTHER)` instead of the installer screen, so
the install does not lock. Built and removed on 2026-11-04. It cannot reach
its goal in PhoneCanDo's flow: the lock is set when lite is first installed
from a file, and full inherits it through the update (see the mechanism
above). Expected `appops` after a session update: `deny`. No APK with it
remains (the 2026-11-04 lite that had it was rebuilt the next day), so Play
Protect's verdict on a session install was never measured.

Where it could still matter:
- Android 13 self-updates: an installer-screen update re-locks on 13, a
  session update does not.
- Devices with the ECM flags on and no trusted-installer list: there the
  guard is decided lazily from the current install source, which the session
  makes `OTHER`. How common that is is unknown; Google devices may ship a
  list, which would guard PhoneCanDo anyway.

Why it was removed rather than fixed: besides the missing goal, the built
version misread the lock after its own update (full's current source became
`OTHER`), had no fallback when Play Protect blocks after commit, and returned
before the user confirmed, so the update dialog reported a cancel while
Android's confirm screen was still up. A rebuild needs all three handled. Its
core, for reference:

```kotlin
val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL)
params.setPackageSource(PackageInstaller.PACKAGE_SOURCE_OTHER)   // API 33+
params.setInstallReason(PackageManager.INSTALL_REASON_USER)
val id = installer.createSession(params)
installer.openSession(id).use { session ->
  session.openWrite("base.apk", 0, apk.length()).use { out ->
    apk.inputStream().use { it.copyTo(out) }
    session.fsync(out)
  }
  // Status broadcast to a RECEIVER_NOT_EXPORTED receiver via a FLAG_MUTABLE
  // PendingIntent: STATUS_PENDING_USER_ACTION carries Intent.EXTRA_INTENT,
  // which must be started (NEW_TASK) to show Android's confirm screen;
  // STATUS_FAILURE_ABORTED is the user's cancel; other failures need the
  // ACTION_VIEW fallback.
  session.commit(statusPendingIntent.intentSender)
}
```

`PACKAGE_SOURCE_STORE` would be false and stays out either way.

## Sources

- AOSP via LineageOS mirrors (paths as in AOSP):
  `services/core/java/com/android/server/appop/AppOpsService.java`
  (`verifyIncomingOp`, `shouldIgnoreCallback`);
  `services/core/java/com/android/server/pm/InstallPackageHelper.java`;
  `services/core/java/com/android/server/pm/PackageManagerShellCommand.java`;
  `core/java/android/app/AppOpsManager.java`;
  `core/java/android/content/pm/PackageInstaller.java`;
  `core/res/AndroidManifest.xml` (permission levels);
  `packages/SettingsLib/src/com/android/settingslib/RestrictedLockUtilsInternal.java`;
  `packages/apps/Settings/AndroidManifest.xml`,
  `src/com/android/settings/ActionDisabledByAppOpsDialog.java`,
  `src/com/android/settings/applications/appinfo/AppInfoDashboardFragment.java`,
  `src/com/android/settings/accessibility/RestrictedPreferenceHelper.java`;
  `packages/modules/Permission/service/java/com/android/ecm/EnhancedConfirmationService.java`,
  `framework-s/java/android/app/ecm/EnhancedConfirmationManager.java`,
  `PermissionController/AndroidManifest.xml`,
  `PermissionController/src/com/android/permissioncontroller/ecm/EnhancedConfirmationDialogActivity.kt`;
  `data/etc/enhanced-confirmation.xml`.
- Google help, "Allow restricted settings":
  https://support.google.com/android/answer/12623953
- Esper, Android 13 sideloading restriction (deny → ignore → allow, session
  installs exempt):
  https://www.esper.io/blog/android-13-sideloading-restriction-harder-malware-abuse-accessibility-apis
- Android Authority on Android 15 ECM (allowlist-based):
  https://www.androidauthority.com/android-15-enhanced-confirmation-mode-3436697/
