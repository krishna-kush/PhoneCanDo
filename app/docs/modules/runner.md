# phonecando-runner (engine host)

`phonecando-runner` (`com.phonecando.runner`) is the Expo module that hosts
the on-device engine (opencode today), owns the foreground service and seeds
the agent config.
All native code is autolinked; `app/android/` is generated.

## Native API

- `PhoneCanDoRunnerModule.kt`: `getPrefix`, `isServeRunning`, `startServe`,
  `stopServe`, `startServeService`, `stopServeService`, `setActiveSession`,
  `getServePort`, `health`.
- `PhoneCanDoServeService.kt`: the foreground service (`dataSync` type).
- `AndroidManifest.xml`: service declaration plus `FOREGROUND_SERVICE*`
  permissions (merged at build).

## opencode payload (v2)

Ships the native bionic opencode payload (`libopencode2.so` + `libopentui.so` as
`jniLibs` `*.so` names, `extractNativeLibs=true`): executed directly (its
INTERP is the OS linker; bionic system libs only). Payload is self-built
(`opencode v2.0.26-android-phonecando.1`: upstream + embedded web UI + pair API,
see `docs/bootstrap/oc-build.md`): staged via
`scripts/bootstrap/stage-v2.sh` into module `jniLibs`.

On an opencode/web-UI bump, recheck the embedded theme override
(`ChatWebScreen.themeScript`, opencode's internal `--v2-*` vars); see
`docs/bootstrap/oc-build.md` → Bumping versions.

## Serve service

`PhoneCanDoServeService` supervises `serve --hostname 127.0.0.1`. The service owns the port: first
request is 4097, the last-good port persists in prefs (survives null-intent
restarts), and a squatted port falls back to an OS-assigned free loopback
port. JS adopts the effective port via `getServePort` — ports are plumbing,
never shown in Settings.

v2 serve is auth-first: the service generates one install-stable password,
hands it to serve via `OPENCODE_SERVER_PASSWORD`, and stashes it in prefs —
the SSE stream, native health, every JS call, and the TUI all use it (HTTP
Basic, user `opencode`). Serve env also sets `OPENTUI_LIB_PATH` and disables the
file watcher. No model pin: fresh sessions inherit the upstream default.

Lifetime is quiet-when-idle: start on app launch / terminal or web-UI open /
manual Start, self-stop after ~20s idle with nothing open (JS also stops on
background when idle). A null-intent system restart relaunches serve only when
chats are watched/tracked, stays stopped when fully idle. Since the 2026-10-09
cache purge the app reports no sessions to the service (no
`setActiveSession`/`leaveSession` callers), so the watched/tracked maps stay
empty: the notification rests at neutral and the SSE supervisor only drives
quiet shutdown. Native session-report paths are kept idle-neutral (no rebuild
needed); delete them only with a native rebuild.

The service also owns the native invoke from `nativeLibraryDir`
(`libopencode2.so` executed directly), `START_STICKY`, and the live
notification described below.

## Live notification

The service owns the live notification: UI reports opens (`ACTION_SESSION`
id + title) and leaves (`ACTION_LEAVE`); one SSE stream (`/global/event`,
`SseClient` w/ reconnect) feeds a pure `WatchState` machine (`EngineEvent`
parser handles direct + sync frames). Watched chats + background-tracked
sessions render multi-line (`●`/`○` per chat); background finishes post a
sounding `phonecando-done` one-shot that retracts if you return first. A 30s
supervisor heals the stream, drops idle tracked entries, and shuts down a
fully unwatched idle engine. Tap reopens the app. Lifetime is quiet-when-idle:
start on app launch / chat open / manual Start (JS also stops on chat close
when nothing stirred recently).

Note: after the cache purge there are no chat-session reporters, so the
multi-line watch path is currently idle-neutral; the notification does not
learn session ids from the app.

## Agent config seeding

The shared source is `phonecando-runner/opencode-config/`. The module's Gradle
`syncAgentConfig` task packages it into generated Android assets at build time
(a future iOS implementation can copy the same directory).
`PhoneCanDoServeService.seedAgentConfig` writes it to
`files/phonecando-home/.config/opencode/` on every serve start (plugins/skills/
`AGENTS.md` refresh, `opencode.json` only when absent so edits and BYOK keys
survive).

v2 loads **`plugins/<id>/index.ts`** (`@opencode/plugin`, `Plugin.define` +
`ctx.tool.transform`), auto-discovered from the global config dir and from
`<project>/.opencode/plugins/`; V1 `tools/*.ts` and `@opencode-ai/plugin` do
not load (intentional v2 breaking change, verified on device).

## Build flavors

One codebase, two APKs: `PHONECANDO_AUTOMATION=full` (default,
`pnpm android:full`) ships the automation driver; `=play`
(`pnpm android:play`) strips it. The flavor is baked at prebuild time. Full
mechanics and tool gating are in `bridge.md`; the PCE host is in
`automation.md`.

## Not implemented yet

- Boot receiver (note: Android 15+ forbids dataSync FGS from BOOT_COMPLETED).
- Battery-exemption prompt + health-check restart recovery.

These are tracked in `../../../docs/planning/automation.md`.
