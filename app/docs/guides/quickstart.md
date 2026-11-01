# Quickstart

## Prerequisites

- Node + pnpm (`packageManager` is `pnpm@11.11.0`).
- Android SDK and an adb device.
- The staged opencode payload in
  `app/modules/phonecando-runner/android/src/main/libs/arm64-v8a/`
  (`libopencode2.so`, `libopentui.so`). It is gitignored; build it via
  `../../../docs/bootstrap/README.md`.

## Install and run

```sh
pnpm install
adb reverse tcp:8081 tcp:8081
pnpm android:full      # default: full automation flavor
# pnpm android:play    # no accessibility host / PCE
```

`expo run:android` builds and installs the APK. JS/asset-only changes reload
from Metro; native module, manifest or dependency changes need another
`pnpm android:full`.

## First boot

- Home pairs the opencode web UI with a fresh code per mount; projects and
  sessions live there.
- The terminal opens from the header menu + folder picker and attaches to the
  same engine.
- Settings shows engine status and Start/Stop; ports are service-owned.

## Checks

```sh
pnpm typecheck
pnpm check:vectors
```

On-device: logcat `[phonecando-kb]` / `[phonecando-size]`, and
`adb exec-out screencap` for any layout claim. See
`../../../docs/guides/testing.md`.

## Next

- Architecture: `../../../docs/overview/architecture.md`
- Dev loop: `development.md`
- Engine host: `../modules/runner.md`
- Terminal: `../modules/terminal.md`
- Automation contract: `../../../docs/api/README.md`
