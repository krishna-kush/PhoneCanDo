# Optional published-coordinate consumer sample

A standalone Gradle project that depends only on published PCE artifacts
from Maven local. It is deliberately not included in `pce/settings.gradle.kts`
and has no project dependencies. It is not a release gate; the PhoneCanDo app uses
the composite build.

```bash
cd pce
./gradlew publishToMavenLocal
./gradlew -p consumer-sample :api-consumer:run :core-consumer:run
```

Expected output:

```text
api-only backend=noop capabilities=[OBSERVE] selector=Selector(...)
backend action=Tap(backendNodeId=add, point=null)
core-only snapshot=1 node=1 backend=consumer-demo
```

- `api-consumer` depends on `pce-api` alone and implements `Backend`.
- `core-consumer` depends on `pce-core` alone and runs
  observe/resolve/tap with a small in-process backend.

This is the P6 acceptance proof for a fresh consumer. It does not use
`pce-testkit`, Android or PhoneCanDo. For an Android host, add
`pce-android` and wire a real `AccessibilityService` as shown in
`android.md`.
