# Known limits

These are not scheduled work unless they are also listed in
`../planning/todo.md`.

## PCE / API

- `mobile_info.activity` comes from the last accessibility window-state event;
  it is null until the service sees one and can lag a dialog/window transition.
- `Action.Screenshot` has no artifact return path; use observation screenshots.
- Device coverage is currently Android 16 API 36.
- `mobile_wait` compares the host accessibility event sequence when the bridge
  provides it; it still polls, and it is not a general event stream.
- `mobile_home` backgrounds PhoneCanDo. With phone control enabled the host vetoes
  the JS idle shutdown; with phone control off the idle shutdown still applies.

## Accessibility backend

- Screenshot is observation-only; below API 30 it returns `UNSUPPORTED_ACTION`.
- Secure windows fail screenshot capture with `UNSUPPORTED_ACTION`; there is no
  `SECURE_WINDOW` error code yet.
- Only the active window's node tree is observed; other windows are listed but
  not traversed.
- `RawSnapshot.stable` is `false` until a verifier/stability check lands.
- Horizontal scroll and most key codes return `UNSUPPORTED_ACTION`.
- Device-tested on one device only.

## IME backend

- No observation and no node identity: `SetText.backendNodeId` is ignored, so
  the host must focus the correct field.
- Keys use `InputConnection.sendKeyEvent`; text uses `commitText`.
- `clear = true` depends on the field supporting select-all.
- Keys other than Enter and Delete are unsupported.
- Device-tested on one device only.

## Shizuku backend

- Optional WIP; not in the v1 router.
- `ShizukuShell` uses AIDL `newProcess`; move to `UserService` before API 14.
- No text, scroll, screenshot or observation.
- No node identity: tap and long press require coordinates.
- Requires Shizuku API 11+; older servers return `BACKEND_UNAVAILABLE`.
- The shell timeout defaults to 5 seconds and assumes small command output.
- Package-only launches use `monkey` and are best-effort.
- Granted path not device-tested.

## Packs

- Pack crypto is gated below API 33; there is no bundled provider.
- Below-API-33 gate is code-inspected, not device-tested.
- The host owns install, refresh, activation, rollback and download integrity.
- No retries and no branching; flows are a sequential list of steps.
- Only the initial package is checked; system dialogs and other packages are
  allowed during a flow.
- The action set is the PCE's action set; backend capabilities still decide
  what actually runs.
- The runtime never evaluates expressions or loads code from a pack.

## Platform / release

- Shizuku artifact stays local while WIP.
- Remote/JitPack publication is deferred until a consumer needs it.
- The Android harness is activity-driven, not instrumentation; see
  `../modules/android.md`.
