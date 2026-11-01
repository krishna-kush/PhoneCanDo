# pce-android

Clean-room accessibility backend. The host app owns the `AccessibilityService`
and its manifest entry; this module only adapts a live service handle to the
PCE `Backend` contract.

```kotlin
implementation("com.phonecando.pce:pce-android:0.1.0-dev")
```

Add `mavenLocal()` to the host repositories; see `../release/release.md`.

## Host wiring

```kotlin
class AutomationService : AccessibilityService() {
    companion object {
        @Volatile
        var instance: AutomationService? = null
    }

    override fun onServiceConnected() {
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }
}

val backend = A11yBackend(A11yServiceProvider { AutomationService.instance })
val pce = Pce.create(backend)
```

Manifest:

```xml
<service
    android:name=".AutomationService"
    android:exported="true"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
    <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService" />
    </intent-filter>
    <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/accessibility_service_config" />
</service>
```

`res/xml/accessibility_service_config.xml` needs at least:

```xml
<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagRetrieveInteractiveWindows"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:canTakeScreenshot="true"
    android:notificationTimeout="100" />
```

Keep the service and this module out of the `play` flavor. The host gates the
service; the PCE does not know about PhoneCanDo flavors.

## Device harness

`androidTest` builds a standalone, test-only app with `TestActivity` and
`TestAccessibilityService`. It is not an instrumentation test: `am instrument`
force-stops the target package when it starts, which kills the accessibility
service and leaves it marked crashed. The activity is launched as a normal app
instead. A future instrumentation suite must host the service in a separate
package.

Run it from `pce/`:

```bash
./gradlew :android:assembleDebugAndroidTest
adb install -r android/build/outputs/apk/androidTest/debug/android-debug-androidTest.apk

# Launch once to unstop the package after install.
adb shell am start -W -n com.phonecando.pce.android.test/com.phonecando.pce.android.TestActivity

# Save the original value, then enable only the test service. Appending it to
# the PhoneCanDo service did not bind it on this device; test-only did.
adb shell settings get secure enabled_accessibility_services
adb shell settings put secure enabled_accessibility_services \
  "com.phonecando.pce.android.test/com.phonecando.pce.android.TestAccessibilityService"
adb shell settings put secure accessibility_enabled 1
sleep 5
adb shell dumpsys accessibility | grep -E 'Bound services|TestAccessibility'

adb logcat -c
adb shell am start -W -n com.phonecando.pce.android.test/com.phonecando.pce.android.TestActivity \
  --ez run true -f 0x10008000
sleep 15
adb logcat -d -s A11yDeviceTest
```

Expected:

```text
I A11yDeviceTest: screenshot=1080x2400 path=/data/user/0/com.phonecando.pce.android.test/cache/pce-screenshots/snap-....jpg
I A11yDeviceTest: PASS observe/wait/tap/type/long-press/scroll/swipe/screenshot/stale/back
```

Restore the original accessibility settings and uninstall the test APK:

```bash
adb shell settings put secure enabled_accessibility_services "<original>"
adb shell settings put secure accessibility_enabled <original-enabled>
adb uninstall com.phonecando.pce.android.test
```

If the original `enabled_accessibility_services` was `null`, restore it with
`adb shell settings delete secure enabled_accessibility_services` instead of
`put`.

The harness runs `BackendContract.verify`, then checks observe, wait, tap, text
entry, long press, vertical scroll, swipe, Back, screenshot capture through
`ObserveOptions(screenshot = true)`, that `activityName` matches the test
activity, that the explicit `Action.Screenshot` remains `UNSUPPORTED_ACTION`, and
that an old snapshot id is rejected after a screen change and re-observation
(`STALE_SNAPSHOT` for both `act` and `resolve`). Device evidence on 2026-10-29 19:16:36: Android
16/API 36 — PASS including the contract and stale checks, with
`screenshot=1080x2400`. The test service and activity are test-only; they are
not in the published AAR.

## What works

- Observe the active window: nodes, bounds, flags, focused editable node,
  windows, device meta.
- Implemented: tap, long press, set text, global Back/Home/Recents, IME Enter on
  Android 11+, vertical scroll, swipe, launch. Selector taps dispatch a real
  gesture first and fall back to `ACTION_CLICK`: React Native nodes report
  clickable but often have no accessibility click handler, so `ACTION_CLICK`
  silently no-ops. The device harness covers tap, long press, set text,
  vertical scroll, swipe and Back; Home/Recents, Enter and launch are not
  device-exercised yet.
- Screenshot via `ObserveOptions(screenshot = true)` on Android 11+; the
  artifact is a JPEG under the service cache dir. The explicit
  `Action.Screenshot` is still rejected because `Backend.execute` cannot return
  an artifact yet. These are intentionally two paths: observation returns a
  `ScreenshotRef` with the snapshot, while an action returns only
  `PceResult<Unit>`. The action stays reserved until the result contract
  carries an artifact.
- `activityName` comes from the host's optional `A11yActivityNameProvider`,
  which tracks the last `TYPE_WINDOW_STATE_CHANGED` package/class. The PCE
  does not query Android activity state directly.
- Path-based `BackendNodeId` values; no view-object identity leaks.

## Known limits

- Screenshot is observation-only; `Action.Screenshot` has no artifact return
  path yet. The service config must set `android:canTakeScreenshot="true"`.
  Below API 30, screenshot requests return `UNSUPPORTED_ACTION`.
- Secure windows fail screenshot capture with `UNSUPPORTED_ACTION`; there is no
  `SECURE_WINDOW` error code yet.
- Only the active window's node tree is observed; other windows are listed but
  not traversed.
- `RawSnapshot.stable` is `false` until a verifier/stability check lands.
- Horizontal scroll and most key codes return `UNSUPPORTED_ACTION`.
- Stale-snapshot rejection is device-tested (2026-10-29).
- Device-tested on one device only: Android 16/API 36. Other OEMs
  and API levels still need coverage.
- Instrumentation cannot host this service in the target package; see the
  device harness note above.
- A `Service` is not display-associated on Android 16, so rotation is read via
  `DisplayManager.getDisplay(Display.DEFAULT_DISPLAY)`, not `service.display`.
