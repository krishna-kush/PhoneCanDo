# pce-api

Contracts only. No PCE runtime, no Android, no I/O.

```kotlin
implementation("com.phonecando.pce:pce-api:0.1.0-dev")
```

Use this module when you only need to implement a `Backend`, build selectors or
actions, or inspect snapshots. It contains:

- `Backend`, `BackendAction`, `Capability`, `ObserveOptions`
- `RawSnapshot`, `RawNode`, `Snapshot`, `Node`, `NodeFlag`
- `Selector`, `Target`, `Action`, `KeyCode`, `ScrollDirection`
- `PceResult`, `PceError`, `ErrorCode`, `Recovery`
- `PhoneControlEngine`, ids, geometry, clock and trace contracts

A backend implements `observe` and `execute`; the core does resolution and
stale-snapshot checks. See `../api/README.md` and `../guides/consumer.md`.

`api` is pure JVM and is the only dependency an Android, IME or Shizuku backend
needs.
