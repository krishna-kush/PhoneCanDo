# P5 — PhoneCanDo integration

Status: done.

## Status

The first PCE-backed slice is device-proven on 2026-10-30 (Android 16/API 36).
The bridge exposes `GET /pce/describe`,
`POST /pce/observe`, `POST /pce/act` and `POST /pce/pack` behind the
existing biometric gate; the plugin exposes
`mobile_describe`/`observe`/`act`/`pack`. The full-only adapter lives in
`app/modules/phonecando-runner/android/src/uiauto/java` behind the main
`PceAutomation`/`PceAuto` seam. Play APK re-audited after the wrapper
change: no PCE, pack or uiauto classes, no accessibility service and no
`accessibility_config` resource.

Device evidence covers describe, observe, selector and coordinate tap,
`type_text`, `key BACK`, post-action `expect`, and the host pack lifecycle
(list, signed refresh, idempotent refresh, v2→v1 rollback, bad-manifest
signature rejection and incompatible-pack rejection). Pack flow execution is
device-proven too: a signed v4 flow ran through `POST /pce/pack`
`action=run`, returned the tap plus its step `expect` and flow `verify` action
results, and typed errors covered an unknown flow (`NOT_FOUND`) and non-string
params (`bad_request`). Selector taps use a gesture first because React Native
nodes report clickable without handling `ACTION_CLICK`.

The old vendored driver and `/ui/*` routes are gone; the old `mobile_*`
names are plugin wrappers over `observe`/`act` (device-tested 2026-10-30:
screen, info, click, tap, text set/append/replace/clear, scroll, swipe, back,
home, and wait changed/timeout). At P5 time `mobile_info.activity` was empty
because the PCE did not populate `activityName`, and `mobile_wait` was
poll-based; the follow-up host changes add both (native rebuild pending). Packs
are gated below API 33.

## Scope

- app adapter: bridge routes call the PCE; tool names stay `mobile_*`.
- keep biometric gate, master switch, `full`/`play` split.
- remove the old vendored driver and `/ui/*`; keep `mobile_*` names as
  PCE-backed wrappers.
- host pack lifecycle: manifest, `sha256`, storage, atomic swap, rollback.
- pack crypto gate: platform Ed25519 is API 33+ (API 36 probe green), so v1
  gates packs below API 33 and does not bundle a provider.

## Acceptance

- [x] `full`: unlock, observe, tap/text/back, wait, expect; locked calls 403.
- [x] Orb-eye driver and `/ui/*` removed; the old `mobile_*` names are
  PCE-backed wrappers.
- [x] `play`: no a11y service and no PCE, pack or uiauto classes.
- [x] Device evidence: logcat + screenshot for each claimed action.
- [x] Packs can be listed, refreshed and rolled back by the host (device-proven
  2026-10-30).
- [x] Pack flow execution through the app adapter is device-proven
  (2026-10-30).
- [x] Pack install is gated below API 33 with `PACK_INCOMPATIBLE` (decision:
  no bundled Ed25519 provider in v1; below-API-33 gate not device-tested).
