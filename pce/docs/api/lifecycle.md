# Threading, lifecycle and versioning

## Threading and lifecycle

- One `Pce` owns one backend, one current snapshot and one id sequence.
- The PCE serializes actions on one lane; `resolve` reads the current
  snapshot.
- Create one PCE per host/service; close it when the host service stops.
- No global mutable state.

## Versioning

The public API follows semver. Before 1.0, minor releases may contain breaking
changes, but each one gets a migration note. Unstable API is marked
`@ExperimentalPceApi` and may change without a major version. See
`../release/release.md` and `../release/migration.md`.
