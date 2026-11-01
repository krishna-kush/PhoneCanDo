# pce-json

Optional contract JSON. `api` and `core` do not depend on serialization.

```kotlin
implementation("com.phonecando.pce:pce-json:0.1.0-dev")
```

```kotlin
val json = PceJson.encodeSnapshot(snapshot)
val decoded = PceJson.decodeSnapshot(json).getOrThrow()

val selector = PceJson.decodeSelectorStrict(untrustedJson).getOrThrow()
val action = PceJson.decodeActionStrict(untrustedJson).getOrThrow()
```

It encodes/decodes `Snapshot`, `Selector`, `Action` and `PceError`. The
strict selectors/actions reject unknown fields and are used by `pce-pack`
for untrusted pack input.
