# PCE rules — read before touching `pce/`

`pce/` is a separate Gradle build owned by PhoneCanDo. PhoneCanDo is the primary
consumer and owns the roadmap; keep the PCE free of app types. Every rule
here is a quality gate, not a style preference.

## 1. Product boundary

The PCE owns:

- observation and snapshots
- selectors and resolution
- typed actions and execution
- postconditions and verification
- trace and packs

The host app owns:

- HTTP bridge, auth, bearer tokens, rate limits
- biometric gate and master switch
- AI tool names (`mobile_*`), prompts and UI
- app lifecycle, foreground service and notifications

If a change needs an app type, an Expo/React Native type, NanoHTTPD, or a
`mobile_*` name, it does not belong in `pce/`.

## 2. Dependency law

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

- `api`, `core`, `json`, `pack`, `testkit` are pure JVM. No `android.*`, no
  `org.json`, no app packages, no platform imports.
- `android`, `ime`, `shizuku` are the only Android modules and depend on `api`
  only. A backend must not pull in `core`; the host composes backend + core.
- No reverse edges and no cycles. `core` must never import a backend.
- Use `api` for types that are part of a module's public surface; use
  `implementation` for internals. A consumer must not need an accidental
  transitive dependency.
- Each module must build, test and publish alone. Add a module to
  `settings.gradle.kts` only when it has real code and a green build; no empty
  modules.

## 3. Public API law

- Public API is versioned; use `0.1.0-dev` while pre-1.0. Semver and migration
  notes apply when a real external consumer exists.
- Mark unstable API with `@ExperimentalPceApi` before 1.0.
- Every public type and non-obvious function has KDoc.
- No global mutable state or singletons. One `Pce` instance owns one
  backend, one current snapshot and one id sequence.
- Inject `Clock` and `IdGenerator`; never call a wall clock or random source
  directly from PCE logic.
- Expected failures return `PceResult.Err` with an `ErrorCode`. Do not throw
  for "not found", "ambiguous", "stale", "timeout" or backend unavailability.
- Backends are the only platform boundary. The core speaks `Backend`,
  `RawSnapshot` and `BackendAction`; it never sees Android classes.

## 4. Snapshot and action law

- `SnapshotId` is stable for one PCE instance and never reused.
- `NodeId` is dense per snapshot: `nodes[i].id == NodeId(i)`.
- Actions always carry the snapshot id they were resolved against. A stale id
  is rejected; never silently act on a changed screen.
- Resolution is deterministic: multiple matches return `AMBIGUOUS` with
  candidate ids. Do not silently pick the first or "best" node. `index` is the
  explicit disambiguator.
- Backends own their `BackendNodeId`; the core translates a resolved node back
  to that id before executing.
- Declare `Capability` honestly. The PCE rejects an action before calling a
  backend that does not declare the capability.

## 5. Module rules

- `api`: contracts only. No implementation, no Android, no I/O.
- `core`: assembler, registry, resolver, verifier, PCE, scheduler, trace.
  Pure Kotlin/JVM.
- `json`: optional contract serialization. Never force serialization on
  consumers of `api`/`core`.
- `pack`: signed declarative pack loading, validation and flow runtime. Pure
  JVM; depends on `api` + `json`; never executes pack code.
- `testkit`: fakes and fixtures. Must not depend on `core`; it implements the
  public `Backend` contract.
- `android`, `ime`, `shizuku`: one platform concern each. Keep Android
  lifecycle code in the adapter; keep selectors and decisions in `core`.
- `sample`: runnable proof that a host can use the PCE without PhoneCanDo.
- `consumer-sample`: optional published-coordinate proof; it is not part of the
  composite `settings.gradle.kts` and, when run, must not use project
  dependencies.

## 6. Testing

- Every non-trivial branch has a test. Pure logic is tested in pure JVM tests.
- Backend contract tests run against each backend via
  `testkit`'s `BackendContract.verify`; Android-specific behavior also needs
  instrumentation/device evidence.
- `./gradlew build` must be green before a slice is marked done. Run
  `:sample:run` for PCE changes. `consumer-sample` is optional until a
  second consumer exists.
- No sizing/layout/device claim without logs or pixels.
- Keep fixtures in `testkit` reusable; do not copy snapshots into every test.

## 7. Reuse and licensing

- Prefer famous, multi-maintainer, permissive dependencies for edges only:
  AndroidX, kotlinx.coroutines, Shizuku, optional MCP Kotlin SDK, host-side test
  tools.
- Build the PCE core and the a11y backend clean-room. Do not copy code from
  projects without a verified license. Do not embed AGPL projects.
- Record a new dependency's license and why it is not replaceable in
  `docs/planning/plan.md` or `docs/planning/todo.md`.
- Host-side tools (uiautomator2, Maestro, Appium, mobile-mcp) are test oracles,
  never runtime dependencies.

## 8. Workflow

- One concern per commit-sized change. Update `pce/docs/planning/plan.md` and
  `pce/docs/planning/todo.md` when scope or status changes.
- Run the narrowest test first, then `./gradlew build` for the module set you
  touched.
- Never run git commands. The user owns git; use file tools and report.
- Do not add a feature, option or abstraction nobody asked for. The smallest
  complete change wins.

## Review checklist

- [ ] Does this keep `api`/`core`/`json`/`testkit` free of Android and app types?
- [ ] Is state instance-owned and are `Clock`/`IdGenerator` injected?
- [ ] Are expected failures typed `PceResult.Err`?
- [ ] Do actions carry a snapshot id, and is staleness rejected?
- [ ] Are multiple matches explicit `AMBIGUOUS`, not silently ranked?
- [ ] Does every touched module still build and test alone?
- [ ] Is `sample` runnable; is `consumer-sample` runnable when touched?
- [ ] Did `docs/planning/plan.md` / `docs/planning/todo.md` get updated?
