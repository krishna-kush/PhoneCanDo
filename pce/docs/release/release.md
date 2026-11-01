# Publishing the PCE (optional)

Publishing is not on the PhoneCanDo app's critical path: the app builds the PCE
from source through a Gradle composite build. Use these artifacts only for
`consumer-sample/`, an external consumer, or a release you actually need.

## Artifacts

| Coordinate | Platform | Status |
|---|---|---|
| `com.phonecando.pce:pce-api:0.1.0-dev` | JVM | Optional local publish. |
| `com.phonecando.pce:pce-core:0.1.0-dev` | JVM | Optional local publish. |
| `com.phonecando.pce:pce-json:0.1.0-dev` | JVM | Optional local publish. |
| `com.phonecando.pce:pce-pack:0.1.0-dev` | JVM | Optional local publish. |
| `com.phonecando.pce:pce-testkit:0.1.0-dev` | JVM | Optional local publish. |
| `com.phonecando.pce:pce-android:0.1.0-dev` | Android AAR | Optional local publish. |
| `com.phonecando.pce:pce-ime:0.1.0-dev` | Android AAR | Optional local publish. |
| `com.phonecando.pce:pce-shizuku:0.1.0-dev` | Android AAR | Artifact local only while WIP. |

The version is defined once in `pce/build.gradle.kts`. To run the optional
published-coordinate proof:

```bash
cd pce
./gradlew publishToMavenLocal
```

Add `mavenLocal()` to the consumer repositories. A remote repository or JitPack
is added only when a consumer needs it; the Shizuku artifact stays local until
its granted path is proven.

## Semver policy

- Published versions are `MAJOR.MINOR.PATCH`; local development may use a
  prerelease suffix such as `0.1.0-dev`.
- Before 1.0, a minor release may contain a breaking API change, but it must
  include a migration note here and in `changelog.md`.
- From 1.0, breaking public API changes require a major version.
- Additive public API changes are minor; fixes are patch.
- API marked `@ExperimentalPceApi` may change without a major version.
- Pack compatibility is separate: `contract` and `minPce` gate packs; a pack
  that does not match returns `PACK_INCOMPATIBLE`.
- Do not publish the `pce-shizuku` Maven artifact while it is WIP.

## Local proof checklist

Checked for the 2026-10-30 local slice:

- [x] `./gradlew build` is green.
- [x] `./gradlew :sample:run` prints the expected output.
- [x] `./gradlew publishToMavenLocal` (optional).
- [x] `./gradlew -p consumer-sample :api-consumer:run :core-consumer:run` (optional).
- [x] Android/IME/Shizuku device harnesses are green for claimed actions.
- [x] Play flavor audit has no PCE, pack or accessibility service classes.
- [x] `changelog.md` has the version and migration notes.
- [x] `planning/plan.md` and `planning/todo.md` match the shipped state.

## Related

- `migration.md` — migration notes.
- `changelog.md` — release notes.
- `known-limits.md` — cross-module limits.
