# Status

As of 2026-11-05. Device evidence is Android 16 / API 36.

## App and engine

- opencode payload: self-built bionic `opencode v2.0.26-android-phonecando.1`
  (`liboc-engine.so` + `liboc-opentui.so`), web UI embedded, pair API live.
- Home is the pair-loaded opencode web UI; the terminal tab is the TUI over
  the own JNI PTY. Sessions and projects live in the web UI.
- `serve` runs in a foreground service on a service-owned dynamic port, is
  auth-first, and is quiet when idle.
- The loopback bridge, `mobile_*` tools, biometric/master-switch gate,
  five-minute bridge grace and full/lite/play channel split are live.
- The `play` channel builds but is a later feature: nothing is released from
  it and it is untested on a device.
- The sideload path is device-proven (2026-11-03, Android 16, India): lite
  installs from a file manager, installs full in place through the normal
  installer, Play Protect allows it, and the accessibility service enables
  after "Allow restricted settings" (`docs/release/upgrade-test.md`).
- The three-step accessibility guide (Android's "Restricted setting" note
  shown in place, App info → Allow restricted settings, the switch) is
  device-verified on the Moto G96 (2026-11-04,
  `research/restricted-settings.md`). Not yet on a device: the agent waiting
  for the switch and carrying on by itself, the update dialog's own
  "Install unknown apps" step, and the compact step links.
- `activityName` and `eventSeq` are device-verified. The staged
  `mobile_wait` eventSeq comparison lands with the next APK because the
  generated asset was stale.

## Automation

- The PCE-backed slice is live in full builds: `GET /pce/describe`,
  `POST /pce/observe`, `POST /pce/act`, `POST /pce/pack` and
  `mobile_describe/observe/act/pack`.
- Signed pack lifecycle is device-proven: install, idempotent refresh,
  v2→v1 rollback, signature rejection, incompatible pack rejection, and
  active-pack flow execution with step `expect` and flow `verify`.
- Play builds contain no accessibility service, `uiauto`/PCE/pack classes or
  `accessibility_config` resource.
- Not yet: `mobile_execute`, `mobile_flow`, `mobile_doctor`, explicit
  screenshot action, pack crypto below API 33, granted-path Shizuku, vision
  backend.

## PCE modules

- Green: `api`, `core`, `json`, `pack`, `testkit`, `sample`, `android`, `ime`.
- WIP, not in the v1 router: `shizuku` (unavailable path tested; granted path
  and `newProcess` → `UserService` migration await work).
- Details: `pce/docs/overview/status.md`.

## Work tracking

- `research/` — background notes and open questions.
- `pce/docs/planning/todo.md` — open PCE work.
- `../release/known-limits.md` — cross-module limits.
