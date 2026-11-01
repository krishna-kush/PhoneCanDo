# Migration notes

## 0.1.0 — initial PCE release

No prior PCE artifact exists. Consumers start with either `pce-api` for
contracts or `pce-core` for the runtime.

## Composite build for the PhoneCanDo app

The PhoneCanDo app consumes the PCE through a Gradle composite build:

```groovy
includeBuild('../../pce') {
    dependencySubstitution {
        substitute module('com.phonecando.pce:pce-core') using project(':core')
    }
}
```

The app keeps published coordinates in its module build; Gradle substitutes the
included PCE projects. This is the normal local dev path.

Published coordinates remain available for an external consumer:

```kotlin
repositories {
    mavenLocal()
    mavenCentral()
}

dependencies {
    implementation("com.phonecando.pce:pce-core:0.1.0-dev")
}
```

`consumer-sample/` is the optional runnable proof of that path.

## From the old `/ui/*` bridge to the PCE

The old `/ui/*` routes and the vendored driver are removed. A host that
called them should:

1. Create one `Pce` around its accessibility backend.
2. Call `observe` and keep the returned `Snapshot`.
3. Resolve nodes with `Selector` and act with `Action`, passing the snapshot id.
4. Branch on `PceResult.Err`; use `STALE_SNAPSHOT` as the signal to
   re-observe.
5. Replace old screen/info/tap/text/scroll/swipe/back/home/wait calls with the
   equivalent PCE actions.

The old `mobile_*` names remain in the PhoneCanDo host as compatibility wrappers over
`/pce/observe` and `/pce/act`; they are not part of the PCE API.

## From screen-global actions to snapshot-scoped actions

An action now carries the snapshot it was resolved against. The PCE rejects
an action on a stale snapshot instead of guessing. Observe again after a
navigation, dialog or screen change.

## Packs

Packs are declarative JSON with a detached Ed25519 signature over the exact
bytes. The host supplies the trusted public key and owns storage, refresh and
rollback. `minPce`, `contract`, app package and app versionCode are checked
before a flow runs. Pack code is never executed.
