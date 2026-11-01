# JSON

`pce-json` is optional; `api` and `core` never force serialization.

```kotlin
val json = PceJson.encodeSnapshot(snapshot)
val decoded = PceJson.decodeSnapshot(json).getOrThrow()
```

It also encodes/decodes `Selector`, `Action` and `PceError`. Use
`decodeSelectorStrict` and `decodeActionStrict` for untrusted input such as
packs; they reject unknown fields.
