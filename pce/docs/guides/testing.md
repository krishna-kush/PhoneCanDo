# Testing

## Test layers

- Pure JVM tests: `./gradlew :api:test :core:test`.
- Runnable proof: `./gradlew :sample:run`.
- Full build: `./gradlew build`.
- Backend contract tests: one suite per backend via
  `BackendContract.verify`; Android-specific behavior also needs device
  evidence.
- Host-side tools are oracles, never runtime dependencies.

## Device harnesses

The Android, IME and Shizuku harnesses are activity-driven test APKs, not
instrumentation. `am instrument` force-stops the target package and can kill the
service under test. Each module doc has its exact build, install, enable and
restore commands:

- `../modules/android.md`
- `../modules/ime.md`
- `../modules/shizuku.md`

No sizing, layout or device claim is accepted without logs or pixels.

## Publishing (optional)

The PhoneCanDo app uses the composite build. To test the published-coordinate path,
publish to Maven local; add a remote repository only when a consumer needs it.
The checklist is in `../release/release.md`.
