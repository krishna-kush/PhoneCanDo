# P6 — Local proof (optional publishing)

Status: local proof complete on 2026-10-30. The PhoneCanDo app uses a composite
build. Publishing is optional and deferred until a consumer needs it.

## Scope

- optional Maven-local publish (remote/JitPack when needed); semver; changelog.
- optional consumer sample using only published coordinates.
- docs: module docs, API guide, migration notes.

## Acceptance

- [x] A fresh project can depend on `pce-api` alone or `pce-core` alone.
  `consumer-sample/api-consumer` and `consumer-sample/core-consumer` are
  standalone and resolve only published coordinates.
- [x] A fresh Android project can depend on `pce-android` and provide a
  service adapter. `../../modules/android.md` has the host wiring; PhoneCanDo uses
  the composite build and the Android module tests cover the AAR path.
- [x] No PhoneCanDo dependency is required.

See `../../release/release.md` for artifacts and the checklist.
