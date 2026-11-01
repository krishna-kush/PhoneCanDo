# Automation host (PCE)

Full builds wire the standalone PCE into the host. Play builds contain no PCE,
packs or accessibility host; see `bridge.md` for the flavor split.

## Accessibility host

`PhoneCanDoAccessibilityService` lives in `phonecando-runner/android/src/uiauto`
and is a minimal Android lifecycle shell. It creates `PceAutomationImpl`,
registers it in `PceAuto.service`, and owns nothing else; all observation and
action logic lives in the PCE. The old vendored driver and `/ui/*` routes
are removed. The old `mobile_screen/info/click/tap/text/scroll/swipe/back/home/wait`
names are plugin wrappers over `/pce/observe` and `/pce/act`;
`/ui/*` returns 404. `mobile_launch` wraps the PCE `launch` action for installed
apps, while `mobile_open` remains URL-only and rejects app schemes. The runner
manifest declares a MAIN/LAUNCHER `<queries>` entry so `getLaunchIntentForPackage`
can see launcher apps on Android 11+. The bridge shell runs as the PhoneCanDo
UID, so its `pm list packages` output is filtered; it is not proof that an app
is missing. If `mobile_launch` returns `NOT_FOUND`, the agent must try launcher
UI search before reporting the app as absent.
Screen dumps and click/input/scroll targets skip nodes whose bounds are
malformed or whose center is off-display (PhoneCanDo's horizontal pager keeps
off-screen tabs attached).

## Bridge routes

PCE routes (`/pce/*`, full flavor only): `PceAutomationImpl` composes
`Pce.create(A11yBackend(...))` and is registered by the service. The main
bridge sees only `PceAutomation`/`PceAuto`; `/pce/describe`,
`/pce/observe`, `/pce/act` and `/pce/pack` share the biometric gate and
bridge error envelope. `/pce/pack` uses `PackStore` to fetch a signed
manifest plus its `.sig` sidecar, verify `sha256`, install app-private versions,
swap the `active` pointer atomically and roll back. Its `run` action loads and
verifies the active pack, reads the target app's installed `versionCode`, and
executes the named flow through `PackRuntime`; step `expect` and flow `verify`
results are returned. Selector taps use a gesture first (accessibility click
fallback) because React Native nodes report clickable without handling
`ACTION_CLICK`.
`PhoneCanDoAccessibilityService` tracks the package/class of the last
`TYPE_WINDOW_STATE_CHANGED` event and exposes it by package;
`PceAutomationImpl` writes `activity` into the bridge snapshot from it, so
`mobile_info.activity` works even before the PCE AAR is republished.
`A11yBackend` also accepts an optional `A11yActivityNameProvider` for that
republish, without adding an Android type to `pce/api`. The service also exposes a
monotonic `eventSeq`; the bridge snapshot includes it and `mobile_wait` compares
it (falling back to the node signature) so a change that reverts between polls is
still noticed. `PhoneCanDoServeService` records the last authenticated bridge call and
keeps serve alive for five minutes after it; the JS `stopEngineIfIdle` also
vetoes shutdown while phone control is enabled, so `mobile_home` does not strand
the next tool call. Device-verified 2026-10-31: `activityName` and `eventSeq`
work; the staged `mobile_wait` eventSeq comparison lands with the next APK
because the generated asset was stale.

## Implemented slice (2026-10-30)

The PCE-backed slice is live; the rest of the API tree is the target surface.

- Bridge: `GET /pce/describe`, `POST /pce/observe`, `POST /pce/act`,
  `POST /pce/pack`. `act` takes PCE JSON plus `snapshotId` and an optional
  `expect` selector; `pack` takes `list`, `refresh`, `rollback` or `run`. `list`
  includes each active pack's flows and parameters; `run` takes the pack `id`,
  `flow` id and optional string `params`.
- Gate: the same biometric/master switch. Locked calls return HTTP 403
  `automation_off`; a missing accessibility service returns HTTP 503
  `automation_unavailable`.
- Plugin tools: `mobile_describe`, `mobile_observe`, `mobile_act`,
  `mobile_launch`, `mobile_pack`. The existing screen/info/click/tap/text/
  scroll/swipe/back/home/wait tools are PCE-backed wrappers; `/ui/*` is
  removed. `mobile_open` is URL-only (http/https/mailto/tel/geo/market);
  `mobile_launch` is the package launcher.
- Build split: main-source `PceAutomation`/`PceAuto` seam; the full-only
  `PceAutomationImpl` and `PackStore` live under `src/uiauto/java`. Play
  builds exclude the uiauto source/res and PCE dependencies.
- Device-proven 2026-10-30 on API 36: describe, observe, selector tap,
  coordinate tap, `type_text`, `key BACK`, post-action `expect`, and the host
  pack lifecycle (signed refresh, idempotent refresh, v2→v1 rollback, bad
  manifest signature and incompatible pack rejection). Pack flow execution is
  device-proven: a signed v4 `home` flow returned the tap plus its step
  `expect` and flow `verify` action results; an unknown flow returned
  `NOT_FOUND` and non-string params returned `bad_request`. Selector taps use a
  gesture first because React Native nodes report clickable without handling
  `ACTION_CLICK`.
- Tool parity device-proven 2026-10-30: screen, info, click by text, tap,
  text set/append/replace/clear, scroll down/up, swipe, back, home, and wait
  changed/timeout. `/ui/*` now returns 404.
- Not yet: `mobile_execute`, `mobile_flow`, explicit screenshot action, and a
  pack-crypto provider below API 33 (packs are gated there).
- Host metadata: `mobile_info.activity` comes from the accessibility service's
  last `TYPE_WINDOW_STATE_CHANGED`; `mobile_wait` uses the host `eventSeq` when
  present and falls back to the node signature. Device-verified 2026-10-31:
  `activityName` and `eventSeq`; the staged eventSeq comparison lands with the
  next APK because the generated asset was stale.
- Cross-app lifecycle: with phone control enabled, `stopEngineIfIdle` does not
  stop serve when PhoneCanDo is backgrounded, and the service keeps a five-minute
  grace after an authenticated bridge call. `mobile_home` therefore no longer
  strands the next tool call; the JS veto was verified on-device with Metro.
- Known limits: Android 11+ package visibility can hide an installed app from
  `getLaunchIntentForPackage` and from the bridge shell's `pm list packages`;
  `mobile_launch` may return `NOT_FOUND` for an app that is present. The app
  declares a MAIN/LAUNCHER `<queries>` entry, but when a launch still fails the
  agent must fall back to launcher UI search before reporting the app as
  missing.

## Wrapper parity map

| Tool | PCE-backed behavior |
|---|---|
| `mobile_screen` | `observe`; flatten text/desc nodes; `editable` and scrollable-ancestor filters |
| `mobile_info` | `observe`; package, activity, root child count |
| `mobile_click` | `observe`; text/desc/id match plus clickable-parent walk; `act` tap node |
| `mobile_tap` | `act` tap coordinates |
| `mobile_text` | `observe`; focused/first editable; `act` type_text with `clear=!append` |
| `mobile_scroll` | `observe`; target text scrollable ancestor or first scrollable; repeated `act` scroll |
| `mobile_swipe` | `act` swipe |
| `mobile_back` / `mobile_home` | `act` key BACK / HOME |
| `mobile_wait` | poll `observe`; compare `eventSeq` plus snapshot signature |
| `mobile_launch` | `observe`; `act` launch by package, optional activity |

## Pack lifecycle

PCE status (2026-10-30): `pce-pack` implements `load`/`run` with detached
Ed25519 verification, strict validation, compatibility checks and signed
manifest verification (27 tests). The app wires packs through `/pce/pack` and
`mobile_pack`; the host flow is in Bridge routes above. The lifecycle is
device-proven on API 36: install, idempotent refresh, v2→v1 rollback,
bad manifest signature (`PACK_SIGNATURE_INVALID`) and incompatible pack
(`PACK_INCOMPATIBLE`, active version unchanged). Running an active pack flow is
also device-proven through the adapter, including step `expect` and flow
`verify` results. The runtime executes no pack code. Android platform Ed25519
is API 33+; v1 gates packs below API 33 with `PACK_INCOMPATIBLE` and does not
bundle a provider. The debug build uses a test-only public key; a release must
set `phonecando_pack_public_key` to the production key and keep the private key
offline. Key generation and signing commands are in
`../../../pce/docs/modules/pack.md`.

## PCE module status

PCE module status (2026-10-30): the full app build composes `pce-android`; the
main bridge sees only the `PceAutomation` seam. The pack module and host
lifecycle are described under Pack lifecycle above. Play builds contain no PCE,
pack or uiauto classes.
v1 uses `RoutingBackend` in `pce-core` to compose a11y + IME.
`pce-shizuku` is kept as an optional WIP module: it implements key, gesture
and launch actions plus a host-only `ShellRunner`, and its unavailable path is
device-tested, but its granted path and `newProcess` → `UserService` migration
are awaiting work.
It is not wired into v1. Text, scroll, screenshot and observation remain with
a11y and IME. Selector tap behavior is in Bridge routes.

## Target layout

The current P5 slice is `BridgeServer.kt` (`/pce/*`), the main-source
`PceAutomation.kt` seam, and the full-only
`src/uiauto/java/com/phonecando/runner/uiauto/PceAutomationImpl.kt`. The layout
below is the target split, not the current tree.

```
app/modules/phonecando-runner/android/src/main/java/com/phonecando/runner/automation/
  contract/Contract.kt        versions, schemas, error codes
  gateway/AutomationGateway.kt describe/observe/act/execute/flow
  pce/Scheduler.kt         one lane, timeout, cancel
  pce/Observer.kt          windows, tree, screenshot, meta
  pce/Resolver.kt          selectors, scoring, ambiguity
  pce/Executor.kt          typed actions, gestures, waits
  pce/Verifier.kt          postconditions, stability, diff
  backend/Backend.kt          interface + capabilities
  backend/A11yBackend.kt
  backend/ShizukuBackend.kt
  backend/VisionBackend.kt
  packs/PackStore.kt          signed manifest fetch, storage, swap, rollback
                              (pce-pack verifies manifest/pack signatures)
  trace/Trace.kt              ring buffer, artifacts
  audit/Audit.kt
```

The existing `PhoneCanDoAccessibilityService` becomes a thin adapter inside
`A11yBackend`; its tree walking and gestures are reused, but the selector,
compaction, wait, and error logic move into pure, testable classes.

## Roadmap

Phases and non-goals are in `../../../docs/planning/automation.md`. Open PCE work is in
`../../../pce/docs/planning/todo.md`.
