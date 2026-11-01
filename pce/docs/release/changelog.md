# Changelog

All notable changes to the PCE are recorded here. The public API follows the
policy in `release.md`.

## [0.1.0] — unreleased

The local development version is `0.1.0-dev`; publishing is optional.

### Added

- `pce-api`: backend, snapshot, selector, action, error, clock, trace and
  PCE-facade contracts.
- `pce-core`: assembler, snapshot registry, deterministic resolver,
  verifier, one-lane scheduler, trace and capability router.
- `pce-json`: optional snapshot/selector/action/error JSON, with strict
  decoding for untrusted input.
- `pce-pack`: signed declarative packs and manifests, Ed25519 verification,
  strict validation, compatibility checks, named selectors, parameters, step
  `expect`, flow `verify` and a fake-backend runtime.
- `pce-android`: accessibility backend for observation, tap, long press,
  text, keys, scroll, swipe, launch and observation screenshots.
- `pce-ime`: text/Enter/Backspace backend over a host-owned IME.
- `pce-shizuku`: optional WIP privileged backend; unavailable path typed,
  granted path pending.
- `pce-testkit`: `FakeBackend`, fixtures and the reusable
  `BackendContract.verify` suite.
- `consumer-sample/`: standalone published-coordinate proof for `pce-api`
  alone and `pce-core` alone.

### Changed

- PhoneCanDo P5 integration now runs phone control through `/pce/observe` and
  `/pce/act`, with the existing `mobile_*` names as compatibility wrappers.
- Pack flows execute through the app adapter; signed refresh, idempotent
  refresh, rollback and typed rejection are device-proven.
- A11y snapshots accept optional host `activityName`; the PhoneCanDo bridge also
  exposes a monotonic `eventSeq` for `mobile_wait`.
- The play APK is audited to contain no PCE, pack or uiauto classes, no
  accessibility service and no `accessibility_config` resource.

### Removed

- The old vendored driver and all `/ui/*` bridge routes.

### Known limits

- `mobile_info.activity` comes from the host's last accessibility window-state
  event; it is null until the service sees one.
- `Action.Screenshot` is reserved; observation screenshots are the current
  artifact path.
- `mobile_wait` uses the host event sequence when available and falls back to a
  snapshot signature.
- Shizuku's granted path and below-API-33 pack crypto are not proven.
- Device coverage is one Android 16/API 36 device.
