# Quick start

Run from `pce/`:

```bash
./gradlew :api:test :core:test :json:test :pack:test :testkit:test :sample:run
./gradlew :android:compileDebugKotlin :ime:compileDebugKotlin :shizuku:compileDebugKotlin

# Optional published-coordinate proof:
./gradlew publishToMavenLocal
./gradlew -p consumer-sample :api-consumer:run :core-consumer:run
```

Expected sample output:

```text
snapshot=1 backend=fake nodes=4
resolved node=1 text=Search bounds=Bounds(left=40, top=210, right=1040, bottom=310)
ambiguous=AMBIGUOUS candidates=[2, 3]
tap backend=fake sent=Tap(backendNodeId=search, point=null)
assert backend=fake
```

For a published-coordinate consumer, see `consumer.md`. For the test layers and
device harnesses, see `testing.md`.
