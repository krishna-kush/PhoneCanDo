# P3 — IME, capability router and Shizuku

Status: IME and the a11y + IME router are done. Shizuku is optional WIP.

## Status

The IME backend is implemented, builds/publishes alone, and passed its device
harness on 2026-10-29 (Android 16/API 36): text commit, clear,
Backspace, Enter, `BackendContract.verify`, unsupported `observe`, and the
unbound `BACKEND_UNAVAILABLE` path. The a11y + IME capability router is
implemented in `core` as `RoutingBackend` and covered by JVM tests. The Gradle
build is green (core: 64 tests, 15 routing tests).

The Shizuku module is intentionally kept as an optional WIP backend: it
builds/tests/publishes alone and passed its unavailable-path device harness on
2026-10-29, but it is not wired into the v1 router; its granted input path and
the `newProcess` → `UserService` migration are awaiting work.

## Scope

- `ime`: commit text, Enter, Backspace; no visible UI beyond the input view.
  Host-owned `InputMethodService`, `ImeServiceProvider`, `SET_TEXT` and `KEY`;
  `backendNodeId` is ignored because the IME has no node identity.
- `shizuku`: privileged key/gesture/launch fallback, capability gated. Host-owned
  Shizuku permission/provider, pure `ShellRunner` and `ShizukuBackend`, real
  `ShizukuShell` adapter; no observation, text, scroll or screenshot.
  `ShizukuShell` uses Shizuku's AIDL `newProcess` and must move to a
  `UserService` before Shizuku API 14. The module, Gradle setting and public
  backend API stay; it is not part of the v1 router.
- Backend router/fallback policy. `RoutingBackend` in `core` composes a11y +
  IME. Shizuku can be appended later but is not required or wired now.

## Acceptance

- [x] IME commits text into a real field and returns a typed error when not
  bound (device-tested 2026-10-29).
- [x] Shizuku returns `BACKEND_UNAVAILABLE` when absent/ungranted, never
  crashes, and the backend contract suite is green (device-tested 2026-10-29;
  command mapping unit-tested with a fake shell).
- [x] Capability router composes a11y + IME with typed fallback and JVM tests.
- [ ] Shizuku granted-path device test: install Shizuku, grant permission, and
  run a real `echo` plus input action. WIP/awaiting work; not a v1 gate.
- [ ] Move `ShizukuShell` from `newProcess` to `UserService` before Shizuku API
  14. WIP; required only if Shizuku is enabled later.
- [x] IME and Shizuku build and test alone.
