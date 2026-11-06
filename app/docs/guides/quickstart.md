# Quickstart

## Prerequisites

- Node + pnpm (`packageManager` is `pnpm@11.11.0`).
- Android SDK and an adb device.
- The staged opencode payload in
  `app/modules/phonecando-runner/android/src/main/libs/arm64-v8a/`
  (`liboc-engine.so`, `liboc-opentui.so`). It is gitignored; build it via
  `../../../docs/bootstrap/README.md`.

## Install and run

```sh
pnpm install
adb reverse tcp:8081 tcp:8081
pnpm android:full      # default: full phone control + self-update
# pnpm android:lite    # no phone control; GitHub self-update
# pnpm android:play    # no phone control; Play-managed updates
```

Channels are Gradle product flavors; `pnpm android:<channel>` re-applies the
config plugins with `--no-clean` (seconds; Expo CLI 57 would otherwise
regenerate `app/android`) and builds the `<channel>Debug` variant, so
switching channels is one command and compiled outputs are reused. Add
`--clean` to start from scratch.

`pnpm android:<channel>` installs a debug-signed **PhoneCanDo Lite Dev** or
**PhoneCanDo Full Dev** (`com.phonecando.app.<channel>.dev`), separate from
each other and from the release `com.phonecando.app`, so all three can live
on the phone. Debug builds show the update pitch but refuse the install: the
release APK is another package (`com.phonecando.app`), so it would install
beside the dev app, never update it. An adb install also never gets the
restricted-settings lock (it follows the installer's package source, not
debuggability), so those two flows are release-build tests. JS/asset-only changes reload
from Metro; native module, manifest or dependency changes need another
`pnpm android:full`.

## First boot

- Home pairs the opencode web UI with a fresh code per mount; projects and
  sessions live there.
- The terminal opens from the header menu + folder picker and attaches to the
  same engine.
- Settings shows engine status and Start/Stop; ports are service-owned.

## Checks

From `app/` (`./manage check` runs both from the repo root):

```sh
npx tsc --noEmit
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
