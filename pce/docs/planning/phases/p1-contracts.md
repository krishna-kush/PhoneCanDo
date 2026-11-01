# P1 — Contract JSON, full actions, verifier, trace

Status: done.

## Scope

- `json`: DTOs for snapshot, selector, action, error; round-trip tests.
  Done 2026-10-29 (`PceJson`).
- Full action coverage on the fake backend: long press, text, key, scroll,
  swipe, screenshot, launch, wait. Done 2026-10-29 (success + capability failure
  for every action).
- `Verifier`: postconditions and stability; `Assert` uses it. Done 2026-10-29
  (`exists`, `absent`, `stable`; diff deferred).
- `TraceSink`: ring buffer, step records, timings, artifacts; no Android
  dependency. Done 2026-10-29 (`TraceSink`, `RingBufferTraceSink`, PCE
  events).
- Scheduler: one lane, timeout, cancellation; no overlapping actions. Done
  2026-10-29 (core `Mutex` lane; concurrent act test).
- `@ExperimentalPceApi` where needed. Done 2026-10-29: trace API and
  `RingBufferTraceSink`; trace-enabled construction is
  `Pce.createWithTrace`, while `Pce.create` stays stable.
- Backend contract suite in `testkit`. Done 2026-10-29:
  `BackendContract.verify` checks observation invariants and rejects undeclared
  capabilities with `UNSUPPORTED_ACTION`.

## Acceptance

- JSON round-trip preserves ids, selectors, actions and errors.
- Every action has a success test and at least one failure test.
- Trace records every step and survives a failing action.
- A backend can run `BackendContract.verify` from its own test suite.
- `./gradlew build` green.
