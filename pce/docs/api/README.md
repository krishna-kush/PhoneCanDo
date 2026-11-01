# API guide

The PCE is host-neutral: it has no PhoneCanDo, React Native, Expo, bridge or
`mobile_*` types. A host supplies a `Backend`; the core supplies snapshots,
selectors, actions, verification, trace and packs.

Coordinates:

```kotlin
implementation("com.phonecando.pce:pce-api:0.1.0-dev")   // contracts only
implementation("com.phonecando.pce:pce-core:0.1.0-dev")  // runtime + contracts
```

The PhoneCanDo app builds these from source through a composite build. For an
external consumer, publish to Maven local and add `mavenLocal()` before
`mavenCentral()`. `pce-api` is the only dependency needed to implement a
backend; `pce-core` adds `Pce`, the resolver, verifier, registry,
scheduler and trace.

## Reading order

1. `mental-model.md` — backend → snapshot → selector/action.
2. `snapshots.md` — snapshots, node ids and staleness.
3. `selectors.md` — selector fields and ambiguity.
4. `actions.md` — action set and options.
5. `backends.md` — backend contract and routing.
6. `json.md`, `packs.md`, `lifecycle.md` as needed.

For a task-oriented path, use `../guides/consumer.md`.
