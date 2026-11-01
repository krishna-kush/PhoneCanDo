# Packs

`pce-pack` verifies a detached Ed25519 signature over the exact pack bytes,
validates the schema/compatibility, and runs declarative flows. Packs contain
no executable code.

```kotlin
@OptIn(ExperimentalPceApi::class)
val packs = PackRuntime(pce, trustedPackKey, pceVersion = "0.1.0")
val pack = packs.load(packJson, signatureBase64).getOrThrow()
packs.run(pack, flowId = "search", appVersionCode = 150, params = mapOf("query" to "milk"))
```

The host owns pack storage, manifest refresh, rollback and the trusted public
key. See `../modules/pack.md` for the format, signing and errors.
