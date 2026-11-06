# Lite → full upgrade test

Question: can the lite APK install the full APK in place, on a phone where
Play Protect blocks the full APK from a browser or file manager?

Background: Play Protect's enhanced fraud protection hard-blocks installs from
"internet-sideloading sources" (browsers, messaging apps, file managers) when
the APK declares `BIND_ACCESSIBILITY_SERVICE`, `BIND_NOTIFICATION_LISTENER_SERVICE`,
`READ_SMS` or `RECEIVE_SMS`. Full declares the accessibility service; lite
declares none of them. Google does not document how it classifies an app that
installs its own update, so this has to be measured on a device.

## How to measure

Build lite with `./manage build lite`. Its update dialog offers the live full
release; the Update button hands the APK to Android's installer screen
(`ACTION_VIEW`), the production path. Play Protect's verdict is visible in
logcat (`./manage device log`): look for `VerifyApps` lines with
`Originating app`, `Installer app` and the final `VERIFICATION_ALLOW` or block.

A PackageInstaller-session path with declared package sources was built and
kept ready for this test but never needed, since the intent path passed first.
It was removed afterwards (unverified code); re-add it only if Google changes
the rule and this measurement fails.

## Preconditions

- Phone with Google Play services, Play Protect "Scan apps with Play Protect"
  on, in a market where the block applies (India confirmed).
- Confirm the block first: download the full APK in Chrome from the GitHub
  release and try to install it. It must show "App blocked to protect your
  device". If it installs, this phone cannot answer the question.
- The dev loop never shows the block: `adb install` is not an
  internet-sideloading source.

## Steps

1. Remove any installed build (wipes app data):
   `adb uninstall com.phonecando.app`
2. Put lite on the phone the way a user would, without adb install:
   `./manage device push dist/lite/phonecando-<ver>-lite-arm64.apk`
   then open it from the Files app. It should install (lite has no sensitive
   permission). Allow "install unknown apps" for Files if asked.
3. Start capture on the computer: `./manage device log | tee upgrade-test.log`
4. Open PhoneCanDo. About two seconds later the dialog offers the full build.
   Settings → About should say channel `lite`.
5. Tap "Install full build". If "Install unknown apps" is off for PhoneCanDo,
   the app says so first ("One quick OK from Android"); allow it in Android's
   settings and come back, and the install starts by itself. Note exactly what
   appears.
6. On full: Settings → Accessibility → PhoneCanDo. Note whether the toggle is
   greyed out ("restricted setting") and whether App info → ⋮ → "Allow
   restricted settings" unlocks it.

Screenshot each Play Protect dialog (`adb exec-out screencap -p > step.png`).

## Results

| Date | Device / Android | Region | Method | Outcome | Restricted settings |
| --- | --- | --- | --- | --- | --- |
| 2026-11-03 | Moto G96 5G, Android 16, patch 2026-10-01, Play services 26.41.31 | India | browser (baseline) | blocked (confirmed earlier on this phone) | |
| 2026-11-03 | same | India | installer intent (production path) | **installed**. Only prompt: "install unknown apps" for PhoneCanDo. Play Protect log: `Originating app: com.phonecando.app`, `Installer app: com.google.android.packageinstaller`, verdict `VERIFICATION_ALLOW` | Toggle refused with "app was denied access" (`ACCESS_RESTRICTED_SETTINGS: deny`, `packageSource=3`). App info → ⋮ → Allow restricted settings fixed it; service then enabled |

Lite was installed from Files by Google (`initiatingPackageName=com.google.android.apps.nbu.files`,
`packageSource=3`), the same path a user takes after a browser download. The
full install that followed was a plain `ACTION_VIEW` from the lite app; Play
Protect's verifier ran (`VerifyApps: Install-time verification requested`),
read the originating app as PhoneCanDo, and allowed it. Log:
`dist/upgrade-test.log` (not committed). `packageSource=3` is
`PACKAGE_SOURCE_LOCAL_FILE`, the value the installer screen assigns to an
`ACTION_VIEW` install; it is what applies the lock
(`research/restricted-settings.md`).

## Reading the result

- Installer intent passes (current state): lite is the download, the updater
  stays as is.
- It stops passing: the in-app upgrade cannot carry full. The remaining routes
  are ADB-class installs (Shizuku / wireless debugging `pm install`) or
  dropping the accessibility declaration from the downloadable build. A
  PackageInstaller session with a declared package source is a cheaper first
  experiment, but labelling a GitHub download as a store install is the kind
  of signal Google is likely to close.

## Guide and session-install tests (2026-11-04)

Two facts shape these tests (`research/restricted-settings.md`):

- Lite's updater installs the full build published on GitHub
  (`latest.json`), not `dist/`. A lite→full run installs the published full
  whatever `dist/` holds.
- The restricted-settings lock is set when lite is first installed from a
  file, and full inherits it through the in-place update. No update method
  can remove it; only the user's "Allow restricted settings" does.

### Test A: the accessibility guide (local full APK)

Install the local full with a file source declared. That applies the lock
the way a first install from Files does. It wipes the app's data.

```
adb uninstall com.phonecando.app
adb push dist/full/phonecando-<ver>-full-arm64.apk /data/local/tmp/full.apk
adb shell pm install --package-source 3 /data/local/tmp/full.apk
adb shell appops get com.phonecando.app ACCESS_RESTRICTED_SETTINGS
```

Expect `deny` or `default`. Settings → Phone control then shows the three
steps. "1 · Show Android's check": the "Restricted setting" note appears over
the app; after OK, `appops get` reads `ignore` and the guide is on step 2.
"2 · Open app info": ⋮ offers "Allow restricted settings"; allowing it gives
`allow`, and the guide is on step 3. "3 · Open accessibility": the switch
turns on and the card says "Accessibility service: on". An in-place update
(same command plus `-r`) keeps it on with no guide. Full list: "On-device
checks still owed" in `research/restricted-settings.md`.

### Session install (not testable)

A Play Protect test of a session-based install was planned, but that code was
removed on 2026-11-04 and no APK with it remains
(`research/restricted-settings.md`).
