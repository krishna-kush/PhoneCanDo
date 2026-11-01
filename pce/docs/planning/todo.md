# Open work

Legend: `[ ]` todo, `[~]` in progress. Completed milestones are in `done.md`.
Known limits that are not scheduled work are in `../release/known-limits.md`.

## PCE

### 1. Explicit `Action.Screenshot` artifact

- [ ] Define an artifact result path for `Action.Screenshot(full)`.

What is missing: the action exists in the public API, but current backends
reject it with `UNSUPPORTED_ACTION`. `Backend.execute` returns
`PceResult<Unit>`, so there is nowhere to return a screenshot path or bytes.
Observation screenshots already work through
`ObserveOptions(screenshot = true)` on API 30+ and are device-tested; that is
the current artifact path.

Why it matters: a host cannot request a screenshot as a normal action, and the
PCE cannot declare the `SCREENSHOT` capability honestly. A host can still
observe with a screenshot.

What must change: decide the result shape (artifact handle/path/bytes), extend
the backend execution result, update every backend and the contract tests, then
declare `SCREENSHOT` and document it. This is not a v1 blocker.

### 2. Shizuku granted path

- [~] Shizuku is an optional WIP backend, not part of the v1 router.
- [ ] Install Shizuku on the test device, grant permission, and run a real
  `echo` plus a coordinate input action.

What is proven: the module builds/publishes alone, the unavailable path returns
typed `BACKEND_UNAVAILABLE`, the backend contract passes, and command mapping is
unit-tested with a fake shell. The granted path is not device-tested because
Shizuku is not installed on the test device.

Why it matters: until the granted path is proven, Shizuku must not be treated
as supported, and its Maven artifact must not be published.

### 3. Shizuku `newProcess` → `UserService`

- [ ] Move `ShizukuShell` from Shizuku's AIDL `newProcess` to a `UserService`
  before Shizuku API 14.

What is missing: `ShizukuShell` uses the AIDL `newProcess` shortcut from API 13.
Shizuku marks it for removal. The migration is required before enabling
Shizuku in a host or publishing the artifact.

Order: finish the granted-path device test first, then migrate, then consider
adding Shizuku to `RoutingBackend`.

### 4. Remote publication

- [ ] Publish to JitPack or another remote repository only when a consumer
  needs it.

What is done: the published-coordinate consumer sample passes against an
optional Maven-local publish. The PhoneCanDo app uses a composite build, so
publishing is not on its critical path. Remote publication is deliberately
deferred. Keep the `pce-shizuku` artifact local-only while it is WIP.

## Plan acceptance still open

- [ ] Below-API-30 screenshot request returns `UNSUPPORTED_ACTION`; the branch
  is implemented but not device-tested.
- [ ] Explicit `Action.Screenshot` artifact (same item as #1 above).
- [x] Device-verified 2026-10-31: `activityName` returns the real activity,
  `eventSeq` increments across app switches, and the bridge grace is in the
  build. The staged `mobile_wait` eventSeq comparison still needs the next APK
  because the generated asset was stale; the poll fallback remains functional.
- [x] Observation screenshot device-verified on 2026-10-30 in PhoneCanDo and in
  Android Settings: 1080x2400 JPEG, path readable through `run-as`.

## Next recommended

An earlier irreversible-action bug showed that verification is the practical
bottleneck. Before Shizuku or remote publication, make observation screenshots
reliable in the host and add a rule to verify irreversible actions before
retrying. The PCE-side screenshot action can stay deferred while observation
screenshots cover the workflow. The host now also keeps serve alive while phone
control is enabled, so `mobile_home` does not strand the next tool call.
