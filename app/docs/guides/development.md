# Development

## Dev loop

Target: Android 16 device on adb, Metro on `:8081`.

- JS/asset-only changes: reload from Metro. No rebuild.
- `modules/*/android`, `android/`, manifest, native deps: `pnpm android:full`
  (or `expo run:android`).
- New JS native-module imports: restart Metro with `--clear` (the stale haste
  map predates pnpm installs and fails with "Unable to resolve").
- `adb reverse tcp:8081 tcp:8081` before relying on Metro from the device.
- Terminal page changes: regenerate the bundle with
  `node scripts/inline-xterm.js`.

## Stale-JS rule

Metro compiles ≠ phone executes. After Metro restarts, package changes, or
asset changes: cold-start the app and demand fresh JS logs before judging the
UI. Fast Refresh dies silently.

## Verification

- `pnpm typecheck` (`tsc --noEmit`) for types.
- `pnpm check:vectors` for the pure-logic vectors (`scripts/vectors/`).
- `cd agents && ./gradlew build` and `pnpm -C agents check` for agent kinds.
- Host C tests: `sh app/modules/phonecando-terminal/android/src/test/c/run.sh`
  (PTY core) and `bash lre/launcher/test/run.sh` (Linux launcher).
- `cd lre && ./gradlew build` for the Linux runtime modules and their tests.
- logcat tags: `[phonecando-kb]`, `[phonecando-size]`.
- Pixels: `adb exec-out screencap`.
- Never ship a sizing/layout claim without pixels or logs.

## Native payload

The opencode payload, proot and the Default image are built outside the JS
loop and the app build, then staged (all gitignored):

- opencode: `../../../agents/native/opencode/docs/README.md` and
  `../../../agents/native/opencode/docs/build.md`
  (`./manage agent opencode build|stage`), into the runner module's
  `src/agents/opencode/libs/`, which each channel in its manifest picks up.
- proot and its loader: `lre/proot/` (`build-android.sh`, `verify.sh`,
  `stage.sh`), into `phonecando-linux`'s `src/linux/libs/`.
- The Default image: `./manage image fetch|stage` (the locked one, every
  full and lite build) or `./manage image build` + `stage --local` (a local
  one, debug variants only).

The PTY library and the Linux launcher are CMake targets of their modules and
build with the app. Nothing in `app/android/` is hand-edited.

## Rules

Read `../../../AGENTS.md` before changing native, IME, sizing, automation or docs.
One concern per commit-sized change.
