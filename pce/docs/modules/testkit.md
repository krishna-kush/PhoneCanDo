# pce-testkit

Fakes and fixtures for host and backend tests. It implements the public
`Backend` contract and does not depend on `pce-core`.

```kotlin
testImplementation("com.phonecando.pce:pce-testkit:0.1.0-dev")
```

```kotlin
val backend = FakeBackend(Fixtures.rawSnapshot())
val pce = Pce.create(backend) // pce-core is a separate test dependency
```

`FakeBackend` records every `BackendAction`; `Fixtures` provides reusable
snapshots. Backend authors can run the shared checks:

```kotlin
BackendContract.verify(myBackend)
```

The suite covers capability declarations, observation shape, action round-trips,
unsupported actions and close behavior. Platform-specific behavior still needs
device evidence.
