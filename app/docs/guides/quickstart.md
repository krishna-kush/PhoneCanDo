# Quickstart

## Prerequisites

- Node + pnpm (`packageManager` is `pnpm@11.11.0`).
- Android SDK and an adb device.
- The staged opencode payload in
  `app/modules/phonecando-runner/android/src/agents/opencode/libs/arm64-v8a/`
  (`liboc-engine.so`, `liboc-opentui.so`). It is gitignored; build it via
  `../../../agents/native/opencode/docs/README.md`.
- For Linux images (full and lite): proot staged into
  `app/modules/phonecando-linux/android/src/linux/libs/arm64-v8a/`
  (`lre/proot/stage.sh`) and a Default image (`./manage image fetch` +
  `./manage image stage` for the locked one, or `./manage image build` +
  `./manage image stage --local` for a local one, debug builds only). Both are gitignored. Without them the app runs, and first launch
  makes an Android image (no Linux).

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

- First launch makes the first agent and its machine: with Linux, an image
  of the Default env (offline, about half a minute); without (play, or no
  proot or Default image staged), an Android image. A failure says why, with
  Retry and, on the Linux path, Continue without Linux. When more than one
  agent kind can be made, Choose agent comes first (the default kind
  preselected); every other creation path in the Env tab asks the same way.
- Home is the active agent's own UI: opencode's web UI (paired with a fresh
  code per mount), or the TUI of a kind like Claude Code or Gemini CLI,
  after its install finishes. The header title switches agents.
- The header menu opens a terminal: opencode's TUI in a folder you pick, or
  a Linux shell in the agent's machine.
- The Env tab lists envs and their machines (one image + its agent each) and
  adds new ones. An agent's page holds its engine (state, Start/Stop), the
  ways in (chat, terminal UI, Linux shell), its machine, Reset and Delete.
- Settings holds app-wide options only; ports and passwords stay native.

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
