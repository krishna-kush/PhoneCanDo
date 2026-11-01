# Use the PCE from another project

## Coordinates

```kotlin
repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    implementation("com.phonecando.pce:pce-core:0.1.0-dev")
}
```

`pce-api` is enough to implement a backend; `pce-core` adds the runtime.
Publishing to Maven local is optional; the PhoneCanDo app uses a composite build.
See `../release/release.md` for the artifact table and semver policy.

## Minimal consumer

```kotlin
val backend = MyBackend()                 // implements com.phonecando.pce.api.Backend
val pce = Pce.create(backend)       // com.phonecando.pce.core.Pce
val snapshot = pce.observe().getOrThrow()
val node = pce.resolve(snapshot.id, Selector(text = "Add")).getOrThrow()
pce.act(snapshot.id, Action.Tap(Target.Node(node.node.id)))
pce.close()
```

## Compose backends

`RoutingBackend` composes a11y + IME in pure JVM `core`:

```kotlin
@OptIn(ExperimentalPceApi::class)
val backend = RoutingBackend(listOf(a11yBackend, imeBackend))
val pce = Pce.create(backend)
```

Observation uses the first `OBSERVE` backend. `SetText` prefers a11y because it
honors the resolved node, with IME as fallback; the IME ignores the node, so tap
the field first. Enter/Delete prefer IME; Back/Home/Recents prefer a11y;
gestures and launch use constructor order. Fallback happens only on
`UNSUPPORTED_ACTION` or `BACKEND_UNAVAILABLE`, so a failed action is never
repeated after `INTERNAL`, `TIMEOUT` or `CANCELLED`.
Shizuku can be appended as another fallback later, but it is not part of the v1
router.

## Tests

Use `FakeBackend` and `Fixtures` from `pce-testkit`; no Android needed.
Backend authors can run the shared contract checks:

```kotlin
BackendContract.verify(myBackend)
```

## JSON

Depend on `pce-json`:

```kotlin
val json = PceJson.encodeSnapshot(snapshot)
val decoded = PceJson.decodeSnapshot(json).getOrThrow()
```

## Signed packs

Depend on `pce-pack`. The host supplies the trusted Ed25519 public key and
PCE version; the runtime verifies the exact JSON bytes, validates the pack,
and runs a flow:

```kotlin
@OptIn(ExperimentalPceApi::class)
val packs = PackRuntime(pce, trustedPackKey, pceVersion = "0.1.0")
val pack = packs.load(packJson, signatureBase64).getOrThrow()
packs.run(
    pack = pack,
    flowId = "search",
    appVersionCode = 150,
    params = mapOf("query" to "milk"),
).getOrThrow()
```

See `../modules/pack.md` for the format and limits. The host owns pack storage,
refresh and rollback.

## Trace

Pass a sink to the experimental factory:

```kotlin
@OptIn(ExperimentalPceApi::class)
val pce = Pce.createWithTrace(backend, RingBufferTraceSink(capacity = 100))
```

## Platform backends

- Android: `../modules/android.md`; the host owns the `AccessibilityService`.
- IME: `../modules/ime.md`; the host owns the `InputMethodService`.
- Shizuku: `../modules/shizuku.md`; optional WIP, not wired into v1.
