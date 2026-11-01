# P0 — Foundation

Status: done.

## Scope

- standalone Gradle project under `pce/`
- `api` contracts
- `core` snapshot assembler, registry, resolver, PCE facade
- `observe`, `resolve`, `tap`, `assert`, `wait`, and typed action translation
- `testkit` fake backend and fixtures
- runnable `sample`

## Acceptance

- `./gradlew :api:test :core:test :sample:run` is green.
- The sample prints a snapshot, a resolved node, an ambiguity error, a tap and
  an assert without Android.
- `api`/`core`/`testkit` contain no Android or app imports.

## Proof (2026-10-29)

```text
snapshot=1 backend=fake nodes=4
resolved node=1 text=Search bounds=Bounds(left=40, top=210, right=1040, bottom=310)
ambiguous=AMBIGUOUS candidates=[2, 3]
tap backend=fake sent=Tap(backendNodeId=search, point=null)
assert backend=fake
```
