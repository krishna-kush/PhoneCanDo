# P2 — Android accessibility backend

Status: done except the explicit `Action.Screenshot` artifact and below-API-30
device proof.

## Status

The module, observer and action translation compile and publish. Core actions
and observation screenshots passed a device harness on 2026-10-29 (Android
16/API 36): observe, wait, tap, type, long press, vertical scroll, swipe,
Back and a 1080x2400 JPEG. The harness also runs `BackendContract.verify` and
checks stale `act`/`resolve` rejection; that run passed on 2026-10-29.

## Scope

- `android`: `AccessibilityService` adapter, raw snapshot observer, windows,
  device meta, focused node, screenshot reference via
  `ObserveOptions.screenshot`; explicit action artifact pending.
- Tap/long-press/text/key/scroll/swipe/launch actions. Implemented and
  device-tested for the listed harness actions; launch is not exercised yet.
- Stable `BackendNodeId` generation; no reliance on view object identity.
- Capability declarations and service lifecycle. The `SCREENSHOT` action is not
  declared because it has no artifact result.
- `RawSnapshot.stable` is `false` until a backend stability check lands; the
  core `Verifier` already rejects unstable snapshots.

## Device harness

- `androidTest` builds a standalone test-only app with `TestActivity` and
  `TestAccessibilityService`; see `../../modules/android.md` for commands.
- The harness is activity-driven, not instrumentation: `am instrument`
  force-stops the target package, killing the accessibility service and marking
  it crashed. A future instrumentation suite must host the service in a separate
  package.
- Evidence (2026-10-29 19:16:36):
  `A11yDeviceTest: screenshot=1080x2400` and
  `A11yDeviceTest: PASS observe/wait/tap/type/long-press/scroll/swipe/screenshot/stale/back`.
  The same run executed `BackendContract.verify` and both stale checks.
- The device run found and fixed `A11yBackend` rotation lookup: a `Service` is
  not display-associated on Android 16, so use
  `DisplayManager.getDisplay(Display.DEFAULT_DISPLAY)`.
- The service config needs `android:canTakeScreenshot="true"`; without it
  `takeScreenshot` fails with "Services don't have the capability of taking the
  screenshot."
- Device settings were restored to the pre-test service after the run.

## Acceptance

- [x] Device test: observe a real app, resolve by content description, tap,
  type, scroll, swipe, Back, wait. (2026-10-29)
- [x] Stale snapshot is rejected after a screen change.
- [x] Observation screenshot works on API 30+ (JPEG artifact, device-tested on
  API 36).
- [ ] Below-API-30 screenshot request returns `UNSUPPORTED_ACTION`; branch is
  implemented but not device-tested.
- [ ] Explicit `Action.Screenshot` returns an artifact; needs an API result
  change.
- [x] No third-party driver code; clean-room implementation.
- [x] `full` build only; `play` has no a11y service.
