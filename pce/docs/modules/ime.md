# pce-ime

Text and key backend over a host-owned `InputMethodService`. The host owns the
IME service, its manifest entry and its input view; this module only adapts a
live service handle to the PCE `Backend` contract.

```kotlin
implementation("com.phonecando.pce:pce-ime:0.1.0-dev")
```

Add `mavenLocal()` to the host repositories; see `../release/release.md`.

## Host wiring

```kotlin
class PceImeService : InputMethodService() {
    companion object {
        @Volatile
        var instance: PceImeService? = null
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    override fun onDestroy() {
        if (instance === this) instance = null
        super.onDestroy()
    }

    // MyKeyboardView is the host's own input view.
    override fun onCreateInputView(): View = MyKeyboardView(this)
}

val backend = ImeBackend(ImeServiceProvider { PceImeService.instance })
```

Manifest:

```xml
<service
    android:name=".PceImeService"
    android:exported="true"
    android:permission="android.permission.BIND_INPUT_METHOD">
    <intent-filter>
        <action android:name="android.view.InputMethod" />
    </intent-filter>
    <meta-data
        android:name="android.view.im"
        android:resource="@xml/method" />
</service>
```

`res/xml/method.xml` can be minimal:

```xml
<input-method xmlns:android="http://schemas.android.com/apk/res/android" />
```

The backend declares `SET_TEXT` and `KEY`. It has no observation: `observe`
returns `UNSUPPORTED_ACTION`, and `SetText.backendNodeId` is ignored. The host
must focus the intended field before routing text or keys to the IME backend.
When composed with `RoutingBackend`, `SetText` uses the observing backend first
because it honors the resolved node, with this IME as fallback; Enter/Delete
prefer this IME.

## Device harness

`androidTest` builds a standalone, test-only app with `TestActivity` and
`TestImeService`. It is activity-driven, not instrumentation, for the same
reason as the a11y harness: `am instrument` force-stops the target package.

Run it from `pce/`:

```bash
./gradlew :ime:assembleDebugAndroidTest
adb install -r ime/build/outputs/apk/androidTest/debug/ime-debug-androidTest.apk

# Launch once to unstop the package after install.
adb shell am start -W -n com.phonecando.pce.ime.test/com.phonecando.pce.ime.TestActivity

# Save the original IME, then enable and select the test IME.
adb shell settings get secure default_input_method
adb shell ime enable com.phonecando.pce.ime.test/com.phonecando.pce.ime.TestImeService
adb shell ime set com.phonecando.pce.ime.test/com.phonecando.pce.ime.TestImeService

adb logcat -c
adb shell am start -W -n com.phonecando.pce.ime.test/com.phonecando.pce.ime.TestActivity \
  --ez run true -f 0x10008000
sleep 15
adb logcat -d -s ImeDeviceTest
```

Expected:

```text
I ImeDeviceTest: PASS set-text/clear/backspace/enter/unbound/contract
```

Restore the original IME and remove the test app:

```bash
adb shell ime set "<original-ime-id>"
adb shell ime disable com.phonecando.pce.ime.test/com.phonecando.pce.ime.TestImeService
adb uninstall com.phonecando.pce.ime.test
```

If the original id was `null`, use `adb shell ime reset` instead of `ime set`.

The harness runs `BackendContract.verify`, checks text commit, `clear = true`,
Backspace, Enter, the unsupported `observe` result, an unsupported key, and the
`BACKEND_UNAVAILABLE` result from an unbound backend. Device evidence on
2026-10-29 21:02:18: Android 16/API 36 — PASS. The original Gboard
IME was restored and the test APK was uninstalled. The test service and activity
are test-only; they are not in the published AAR.

## What works

- `BackendAction.SetText` commits into the active input connection. With
  `clear = true`, it selects all and sends Delete first.
- `BackendAction.Key(KeyCode.ENTER)` sends Enter.
- `BackendAction.Key(KeyCode.DELETE)` sends Backspace.
- Unbound service or missing input connection returns `BACKEND_UNAVAILABLE`;
  unsupported actions and keys return `UNSUPPORTED_ACTION`.

## Known limits

- No observation and no node identity: `SetText.backendNodeId` is ignored, so
  the host must ensure the correct field is focused.
- Keys use `InputConnection.sendKeyEvent`; text uses `commitText`. A field that
  ignores key events may need a future `deleteSurroundingText` fallback.
- `clear = true` depends on the field supporting select-all.
- Keys other than Enter and Delete are unsupported.
- Device-tested on one device only: Android 16/API 36.
