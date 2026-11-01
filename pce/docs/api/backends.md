# Backend contract and routing

Implement `com.phonecando.pce.api.Backend`:

```kotlin
class MyBackend : Backend {
    override val id = "my-backend"
    override val capabilities = setOf(Capability.OBSERVE, Capability.TAP)

    override suspend fun observe(options: ObserveOptions): PceResult<RawSnapshot> = ...
    override suspend fun execute(action: BackendAction): PceResult<Unit> = ...
}
```

- Declare capabilities honestly. The core rejects an action before calling a
  backend that does not declare the required capability.
- `observe` returns a `RawSnapshot`; do not return core `Snapshot` types.
- `execute` receives `BackendAction` after the core resolves the target.
- Return typed errors for unavailable services, unsupported actions and
  platform failures.
- `close` is the host's chance to release the platform handle.

Backend authors can run the shared contract suite:

```kotlin
BackendContract.verify(myBackend)
```

`pce-testkit` also provides `FakeBackend` and `Fixtures` for host tests.

## Routing backends

`RoutingBackend` composes an observing backend (accessibility) with a text/key
backend (IME):

```kotlin
@OptIn(ExperimentalPceApi::class)
val backend = RoutingBackend(listOf(a11yBackend, imeBackend))
val pce = Pce.create(backend)
```

Observation uses the first `OBSERVE` backend. `SetText` prefers the observing
backend because it honors the resolved node; IME is the fallback. Enter/Delete
prefer IME. Back/Home/Recents prefer accessibility. Fallback happens only on
`UNSUPPORTED_ACTION` or `BACKEND_UNAVAILABLE`, never after `INTERNAL`,
`TIMEOUT` or `CANCELLED`.
