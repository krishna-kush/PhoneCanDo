# Mental model

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

## Minimal core consumer

```kotlin
val pce = Pce.create(backend)
try {
    val snapshot = pce.observe().getOrThrow()
    val node = pce.resolve(snapshot.id, Selector(text = "Add")).getOrThrow()
    pce.act(snapshot.id, Action.Tap(Target.Node(node.node.id))).getOrThrow()
} finally {
    pce.close()
}
```

`getOrThrow()` is a sample/test convenience. Production code should branch on
`PceResult.Ok` and `PceResult.Err` and inspect `PceError.code`,
`message`, `recovery` and `candidates`.

The runnable `consumer-sample/` project proves both dependency shapes against
published coordinates: `api-consumer` depends on `pce-api` alone and
implements `Backend`; `core-consumer` depends on `pce-core` alone and runs
observe/resolve/tap with a small in-process backend. See
`../guides/consumer.md`.
