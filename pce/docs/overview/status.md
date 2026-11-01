# Status

As of 2026-10-30:

- `0.1.0-dev` is the local development version.
- The PhoneCanDo app builds the PCE from source through a Gradle composite build.
- P0–P6 local proof work is complete; publishing is optional.
- `consumer-sample/` is an optional proof of `pce-api`-only and
  `pce-core`-only consumers.
- The a11y backend passed its device harness for observe, wait, tap, type,
  long-press, scroll, swipe, Back and observation screenshots on an Android
  16/API 36 device.
- The IME backend passed its device harness for set-text, clear, Backspace,
  Enter, unbound and contract checks.
- Shizuku is an optional WIP backend: the unavailable path is device-tested;
  the granted path is not.
- Packs are signed, validated and flow-tested; the host lifecycle is
  device-proven in PhoneCanDo.
- The PhoneCanDo P5 integration is device-proven; `/ui/*` and the old vendored driver
  are removed.
- Host `activityName` and bridge `eventSeq` are device-verified; the
  `mobile_wait` eventSeq comparison is staged for the next APK, and the
  five-minute bridge grace is in the build.

Open work: `../planning/todo.md`.
Known limits: `../release/known-limits.md`.
