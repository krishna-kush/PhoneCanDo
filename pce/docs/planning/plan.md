# Product plan

The PCE is a modular Android automation build owned by PhoneCanDo. PhoneCanDo is the
primary consumer. See `../overview/architecture.md` for the boundary and
dependency law.

## Phase status

| Phase | Scope | Status |
|---|---|---|
| P0 | Foundation: api, core, testkit, sample | Done |
| P1 | JSON, full actions, verifier, trace, scheduler | Done |
| P2 | Android accessibility backend | Done except explicit screenshot artifact and below-API-30 proof |
| P3 | IME, capability router, Shizuku | IME/router done; Shizuku optional WIP |
| P4 | Signed packs and flows | Done |
| P5 | PhoneCanDo integration | Done |
| P6 | Local proof | Done; publishing optional until a second consumer |

## Phase docs

- `phases/p0-foundation.md`
- `phases/p1-contracts.md`
- `phases/p2-android.md`
- `phases/p3-ime-router-shizuku.md`
- `phases/p4-packs.md`
- `phases/p5-phonecando.md`
- `phases/p6-release.md`

## Current slice

Implemented under `pce/`:

- `api` — ids, geometry, node, snapshot, raw snapshot, selector, action, errors,
  backend, clock, PCE facade, `ExperimentalPceApi`.
- `core` — `SnapshotAssembler`, `SnapshotRegistry`, `Resolver`, `Verifier`,
  `Pce`, `AtomicSnapshotIdGenerator`, `RingBufferTraceSink`, one-lane
  scheduler, `RoutingBackend`.
- `testkit` — `FakeBackend`, `Fixtures`, `BackendContract`.
- `json` — `PceJson`, DTO mapping, round-trip and strict decoding.
- `pack` — `PackRuntime`, pack/flow models, Ed25519 verification, strict
  validation and fake-backend flow tests.
- `android` — `A11yBackend`, service provider, observation screenshots, device
  harness; explicit screenshot action pending.
- `ime` — `ImeBackend`, `ImeServiceProvider`, device harness.
- `shizuku` — WIP optional `ShizukuBackend`, `ShellRunner`, `ShizukuShell`.
- `sample` — composite-build demo.
- `consumer-sample` — optional published-coordinate consumers.

Open work: `todo.md`.
Completed milestones: `done.md`.
