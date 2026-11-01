# pce-shizuku

Optional privileged input fallback over [Shizuku](https://github.com/RikkaApps/Shizuku-API).
The host owns Shizuku installation, the permission request and the provider
declaration; this module only turns key and gesture actions into `input` shell
commands and exposes a host-only `ShellRunner`.

Shizuku is MIT-licensed. It is the only practical way to get shell identity on
a non-rooted device, so it stays an optional edge dependency; the PCE never
requires it.

```kotlin
implementation("com.phonecando.pce:pce-shizuku:0.1.0-dev")
```

Local artifact only while WIP; see `../release/release.md`.

> **Status: WIP / awaiting work.** The module, its Gradle setting and its public
> backend API are intentionally kept, but it is **not** wired into the v1
> router. The unavailable path is device-tested; the granted path is not. Do not
> treat it as supported, and do not publish the Maven artifact until the granted
> path is proven.

## What it does

`ShizukuBackend` declares:

- `KEY` — all `KeyCode` values via `input keyevent`.
- `TAP` — coordinate taps via `input tap`.
- `LONG_PRESS` — coordinate long presses via `input swipe`.
- `SWIPE` — `input swipe`.
- `LAUNCH` — `am start -n` for an explicit activity, or `monkey` for a
  package-only launch.

It does not observe and has no node identity. A tap or long press must carry a
`Point`; a node-only action returns `UNSUPPORTED_ACTION`. Text, scroll,
screenshots and observation stay with the accessibility and IME backends. The
module also exposes `ShizukuShell`/`ShellRunner` for host-owned device
operations; never expose a raw shell action to an AI.

## Host wiring

Add the Shizuku provider to the host app:

```kotlin
implementation("dev.rikka.shizuku:provider:13.1.5")
```

The PCE artifact already brings `dev.rikka.shizuku:api:13.1.5`. Declare the
provider in the host manifest (the authority must use the host application id):

```xml
<provider
    android:name="rikka.shizuku.ShizukuProvider"
    android:authorities="${applicationId}.shizuku"
    android:enabled="true"
    android:exported="true"
    android:multiprocess="false"
    android:permission="android.permission.INTERACT_ACROSS_USERS_FULL" />
```

Ask for permission in the host before using the backend:

```kotlin
if (Shizuku.pingBinder() &&
    Shizuku.checkSelfPermission() != PackageManager.PERMISSION_GRANTED
) {
    Shizuku.requestPermission(REQUEST_CODE)
}
```

Then compose the backend:

```kotlin
val backend = ShizukuBackend(ShizukuShell())
```

The host should route only actions the backend declares. The backend returns
`BACKEND_UNAVAILABLE` when Shizuku is absent, not running or not granted;
`UNSUPPORTED_ACTION` for node-only or unsupported actions; `INVALID_ACTION` for
an invalid launch package/activity; `TIMEOUT` when a shell command exceeds the
budget; and `INTERNAL` when a shell command exits nonzero.

## Device harness

The harness is activity-driven for the same reason as the other PCE
harnesses: `am instrument` force-stops the target package. It is a test-only
app and is not in the published AAR.

```bash
./gradlew :shizuku:assembleDebugAndroidTest
adb install -r shizuku/build/outputs/apk/androidTest/debug/shizuku-debug-androidTest.apk
adb logcat -c
adb shell am start -W -n com.phonecando.pce.shizuku.test/com.phonecando.pce.shizuku.TestActivity \
  --ez run true -f 0x10008000
sleep 5
adb logcat -d -s ShizukuDeviceTest
adb uninstall com.phonecando.pce.shizuku.test
```

On a device without Shizuku (the current test device) the expected
line is:

```text
I ShizukuDeviceTest: PASS unavailable/contract/fake-input
```

Device evidence on 2026-10-29 21:20:33: Android 16/API 36 —
`PASS unavailable/contract/fake-input`. The harness checks
`BackendContract.verify`, the typed `BACKEND_UNAVAILABLE` result from
`ShizukuShell` and `ShizukuBackend`, and the command mapping through a fake
`ShellRunner`. If Shizuku is installed and granted, it instead logs
`PASS granted/contract/fake-input` and runs `echo pce-shizuku` through the
real shell; it still uses the fake runner for input commands so it does not
mutate the screen. The granted input path has not been device-tested yet.

## Pending work

This module is kept as an optional WIP backend, not a v1 deliverable.

1. Install Shizuku on the test device, grant permission, and run the real granted
   path: `echo pce-shizuku` plus a coordinate input action. Only the
   unavailable path is device-proven today.
2. Move `ShizukuShell` from the AIDL `newProcess` shortcut to a `UserService`
   before Shizuku API 14.
3. Wire it into `RoutingBackend` only after 1 and 2 pass. Until then, v1 uses
   the accessibility + IME router.

## Known limits

- `ShizukuShell` uses Shizuku's AIDL `newProcess` from API 13. Shizuku marks
  that method for removal; move to a `UserService` before Shizuku API 14.
- No text, scroll, screenshot or observation. Use the accessibility or IME
  backend for those.
- No node identity: tap and long press require coordinates.
- Requires Shizuku API 11+; older servers return `BACKEND_UNAVAILABLE`.
- The shell timeout defaults to 5 seconds and assumes small command output.
- Package-only launches use `monkey` and are best-effort; explicit activity
  launches use `am start -n`. Verify the foreground package as a postcondition.
- Device-tested on one phone only: Android 16/API 36. The granted
  path is still pending because Shizuku is not installed on that phone.
