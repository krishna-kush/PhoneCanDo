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
- `pnpm check:vectors` for the pure terminal vectors (`keys.ts`,
  `reconcile.ts`).
- logcat tags: `[phonecando-kb]`, `[phonecando-size]`.
- Pixels: `adb exec-out screencap`.
- Never ship a sizing/layout claim without pixels or logs.

## Native payload

The opencode and PTY payloads are built outside the JS loop. See
`../../../docs/bootstrap/README.md` and
`../../../docs/bootstrap/oc-build.md`. The app ships
the staged `*.so` files from the runner/terminal module `jniLibs`; nothing in
`app/android/` is hand-edited.

## Rules

Read `../../../AGENTS.md` before changing native, IME, sizing, automation or docs.
One concern per commit-sized change.
