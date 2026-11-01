# Backends

| Backend | Provides | Availability |
|---|---|---|
| `a11y` | tree, windows, gestures, global actions, screenshot API 30+ | zero setup; default |
| `ime` | text commit, Enter, Backspace | host enables the PhoneCanDo IME; optional text fallback |
| `shizuku` | shell identity: input, screencap, uiautomator dump, am/pm/settings/cmd/logcat | **WIP**: user installs Shizuku; optional, not in the v1 router |
| `vision` | screenshot + Set-of-Mark + multimodal model; OCR fallback | not implemented; opt-in later |

v1 uses `RoutingBackend` in `pce-core` to compose a11y + IME. `pce-shizuku`
is optional WIP and is not wired into v1; its detailed status is in
`../../app/docs/modules/automation.md`. Text, scroll, screenshot and observation remain
with a11y and IME. Selector taps use a real gesture first (with `ACTION_CLICK`
as fallback) because React Native nodes report clickable without handling
accessibility clicks.

## Current v1 routing

- Tree and windows: a11y.
- Input: a11y gestures by default. `SetText` uses a11y first with IME fallback;
  Enter/Delete prefer IME; Back/Home/Recents use a11y.
- Screenshot: a11y `takeScreenshot` API 30+; below 30 is unsupported.
- Device ops: not in v1.
- Vision: only when the tree is empty/ambiguous, the app is canvas-drawn, or
  the user asks. Never every step; not implemented yet.

## When Shizuku is enabled later

- Tree and windows: a11y first, `uiautomator dump` via Shizuku as fallback.
- Input: Shizuku `input` when a11y gestures are blocked or for key events a11y
  cannot send.
- Screenshot: Shizuku `screencap` below API 30.
- Device ops: Shizuku only.

The backend router is a capability negotiation: `mobile_describe` tells the
AI what is available, and missing backends produce `BACKEND_UNAVAILABLE` with
a recovery action.

Host/PCE module status is in `../../app/docs/modules/automation.md`. Backend contract
details are in `pce/docs/api/backends.md`.
