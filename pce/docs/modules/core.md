# pce-core

The default PCE runtime: assembler, snapshot registry, resolver, verifier,
one-lane scheduler, trace and capability router.

```kotlin
implementation("com.phonecando.pce:pce-core:0.1.0-dev")
```

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

One instance owns one backend, one current snapshot and one id sequence. The
core serializes actions; expected failures are `PceResult.Err` with a typed
`ErrorCode`. Stale snapshot ids are rejected, and ambiguous selectors return
`AMBIGUOUS` with candidates.

`RoutingBackend` composes an observing backend with an IME backend:

```kotlin
@OptIn(ExperimentalPceApi::class)
val backend = RoutingBackend(listOf(a11yBackend, imeBackend))
```

`Pce.createWithTrace(backend, traceSink)` is the experimental trace factory.
See `../api/README.md` for the full guide.
