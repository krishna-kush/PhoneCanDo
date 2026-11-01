# Architecture

## Product statement

Build a phone-control engine (PCE) for Android that is useful as a whole
product and as independent parts:

- a host can embed the full PCE (`api + core + android`),
- a host can use only the contracts (`api`),
- a host can use only the resolver/registry (`core`),
- a host can use the a11y, IME or Shizuku backend separately,
- a host can use the testkit without the PCE runtime.

The PCE is not the PhoneCanDo app. PhoneCanDo owns the roadmap and is the primary
consumer; it proves the contract. Nothing in the PCE may depend on PhoneCanDo,
React Native, Expo, NanoHTTPD, the biometric gate or `mobile_*` tool names.

## Host boundary

The PCE owns observation, snapshots, selectors, resolution, typed actions,
verification, trace and packs.

The host owns the HTTP bridge, auth, biometric gate, master switch, AI tool
names, prompts, UI, app lifecycle, foreground service and notifications.

If a change needs an app type, an Expo/React Native type, NanoHTTPD or a
`mobile_*` name, it does not belong in `pce/`.

## Mental model

```
host Backend  ->  RawSnapshot  ->  core Snapshot  ->  Selector / Action
     ^                                                    |
     +---------------- BackendAction <--------------------+
```

- The backend owns platform observation and execution.
- The core assigns dense `NodeId`s, resolves selectors and rejects stale
  snapshots.
- The backend receives a `BackendAction` with its own `BackendNodeId`.
- Expected failures are `PceResult.Err`; do not catch exceptions for them.

## Dependency law

```
api <- core
api <- android
api <- ime
api <- shizuku
api <- json
api <- pack
json <- pack
api <- testkit
core + testkit <- sample
published api/core <- consumer-sample (optional)
```

- `api`, `core`, `json`, `pack`, `testkit` are pure JVM.
- `android`, `ime`, `shizuku` are the only Android modules and depend on `api`
  only. The host composes a backend with `core`.
- No reverse edges, no cycles, no `core -> android`.
- Add a module to `settings.gradle.kts` only when it has real code and a green
  build.
- `api` vs `implementation` must be correct; consumers must not need accidental
  transitive dependencies.

## Public API law

- One PCE instance owns one backend, one current snapshot and one id
  sequence. No global state.
- Inject `Clock` and `IdGenerator`.
- Expected failures are `PceResult.Err` with `ErrorCode`; no exceptions for
  expected conditions.
- `SnapshotId` is stable per PCE; `NodeId` is dense per snapshot.
- Actions carry the snapshot id they were resolved against; stale ids are
  rejected.
- Multiple selector matches are `AMBIGUOUS`; `index` is the explicit
  disambiguator. No silent first match.
- Backends own `BackendNodeId`; the core translates resolved nodes to it.
- Capabilities are declared by each backend and checked before execution.
- Public API is semver. Unstable API gets `@ExperimentalPceApi` before 1.0.

## Reuse policy

The canonical build-vs-reuse verdicts:

- **Use:** Shizuku, AndroidX, kotlinx.coroutines, MCP Kotlin SDK only if MCP is
  needed, and host-side test tools. Shizuku API/AIDL/provider are MIT-licensed;
  they are the optional privileged-shell edge, not a hard dependency.
  `kotlinx.coroutines` and `kotlinx.serialization` are Apache-2.0,
  multi-maintainer JetBrains projects; they are edges for suspend APIs and
  optional JSON, not the PCE core.
- **Build:** observer, resolver, executor, verifier, trace, packs, a11y backend,
  tiny IME.
- **Test-only:** uiautomator2, Maestro, Appium, mobile-mcp.
- **Reference only, do not embed:** droidrun/mobilerun; droid-mcp is a spike
  candidate, not a foundation.
- **Do not use:** unlicensed projects, AGPL projects, dead or
  non-commercial automation apps.

The structural reason: famous projects are host-driven or standalone apps; the
embeddable SDKs are small/single-maintainer. The core is ours; the edges are
reusable.
