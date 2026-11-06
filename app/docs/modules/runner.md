# phonecando-runner (engine host)

`phonecando-runner` (`com.phonecando.runner`) is the Expo module that hosts
the on-device engine (opencode today), owns the foreground service and seeds
the agent config.
All native code is autolinked; `app/android/` is generated.

## Native API

- `PhoneCanDoRunnerModule.kt`: `getPrefix`, `isServeRunning`,
  `startServeService`, `stopServeService`, `setActiveSession`,
  `getServePort`, `health`, `markSelfUpdatePending`.
- `isServeRunning` is true while the engine the service runs is alive
  (`PhoneCanDoServeService.isServeAlive`, safe to read from the JS thread).
  The updater relies on it to stop the engine before a self-update.
- `agents/`: the agent-kind seam. `AgentKind` says how to launch a kind's
  engine, probe its health, read its event stream and seed its config;
  `AgentKinds` lists the kinds. opencode lives in `agents/oc/`
  (`OpencodeKind`, its launch recipe, auth and event parser). The service,
  health checks, SSE and redaction go through a kind, never an agent name.
- `PhoneCanDoServeService.kt`: the foreground service (`dataSync` type).
- `PackageReplacedReceiver.kt`: brings the app back after a self-update
  (see Self-update install).
- `AndroidManifest.xml`: service and receiver declarations plus
  `FOREGROUND_SERVICE*` permissions (merged at build).

## opencode payload (v2)

Ships the native bionic opencode payload (`liboc-engine.so` + `liboc-opentui.so` as
`jniLibs` `*.so` names, `extractNativeLibs=true`): executed directly (its
INTERP is the OS linker; bionic system libs only). Payload is self-built
(`opencode v2.0.26-android-phonecando.1`: upstream + embedded web UI + pair API,
see `docs/bootstrap/oc-build.md`): staged via
`scripts/agents/oc/stage.sh` into module `jniLibs`.

On an opencode/web-UI bump, recheck the embedded theme override
(`src/engine/agents/oc/web.ts`, opencode's internal `--v2-*` vars); see
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
(`liboc-engine.so` executed directly), `START_STICKY`, and the live
notification described below.

Android 15+ lets a `dataSync` foreground service run 6 hours in any 24 while
the app is in the background; bringing the app to the foreground resets the
clock. At the limit Android calls `onTimeout(startId, fgsType)` and crashes
the whole process unless the service stops within seconds. The service
therefore stops the supervisor and SSE, removes its notification, calls
`stopSelf()`, then stops serve and the bridge (`stopSelf` comes before the
wait for serve to exit). Nothing restarts it in the background; the app starts
the engine again when it next comes to the foreground (`App.tsx` calls
`ensureServeRunning` on launch and on every return to the foreground).

## Live notification

The service owns the live notification: UI reports opens (`ACTION_SESSION`
id + title) and leaves (`ACTION_LEAVE`); one SSE stream (the kind's event stream,
`SseClient` w/ reconnect) feeds a pure `WatchState` machine (the kind's
parser maps frames to `EngineEvent`; opencode's handles direct + sync
frames). Watched chats + background-tracked
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

Each kind's source lives under `phonecando-runner/agents/<kind>/`
(opencode: `agents/oc/config/`, plus `config-lite/` for the non-full
channels). The module's Gradle `syncAgentConfig` task packages it into
generated Android assets at build time (opencode: the `oc-config` assets
folder; a future iOS implementation can copy the same directory).
`ConfigSeeder` writes it to the kind's config dir under HOME on every serve
start (opencode: `files/phonecando-home/.config/opencode/`): plugins, skills
and `AGENTS.md` refresh, `opencode.json` is seeded only when absent so edits
and BYOK keys survive. A manifest of the seeded files
(`.phonecando-seeded`) lets the next start delete files we no longer ship,
so a renamed plugin never loads twice; user files are never touched.

v2 loads **`plugins/<id>/index.ts`** (`@opencode/plugin`, `Plugin.define` +
`ctx.tool.transform`), auto-discovered from the global config dir and from
`<project>/.opencode/plugins/`; V1 `tools/*.ts` and `@opencode-ai/plugin` do
not load (intentional v2 breaking change, verified on device).

## Build channels

One codebase, three APKs as Gradle product flavors: `full`
(`pnpm android:full`) ships the automation driver and self-update; `lite`
(`pnpm android:lite`) keeps self-update without the driver; `play`
(`pnpm android:play`) has neither. One prebuild serves every flavor.
Full mechanics, permissions and tool gating are in `bridge.md`; the PCE host
is in `automation.md`.

Build a signed channel APK with `./manage build lite|full` (repo root); the
script audits lite for no accessibility service and no PCE classes, and full
for the opposite. `./manage release <version>` builds both and drafts the
GitHub release.

## Self-update install

`installDownloaded` in `src/engine/updates.ts` hands the downloaded APK to
Android's installer screen with `ACTION_VIEW`. The update dialog first checks
Android's "Install unknown apps" switch for PhoneCanDo
(`canRequestPackageInstalls()`); when it is off, the dialog explains it and
opens that settings page itself, then installs by itself once the user comes
back with it on, instead of Android's own prompt landing on top of the
dialog. Play Protect allows this when
lite installs full because the originating app is PhoneCanDo, not a browser
(device-proven, `docs/release/upgrade-test.md`). After that install, Android
13+ keeps the accessibility toggle locked until App info → ⋮ → Allow
restricted settings, and that menu item only appears after Android has shown
its "Restricted setting" notice for the app. The AOSP 13–16 sources settle
what the app can know (`research/restricted-settings.md`):

- The lock state is unreadable by design. The app op holding it
  (`access_restricted_settings`) is `restrictRead`: every read and every
  watcher callback needs `MANAGE_APPOPS` (signature), and the Android 15+
  `EnhancedConfirmationManager` is SystemApi behind a signature permission.
  Confirmed on device.
- Whether the lock was applied is knowable, because the rule is the install
  source and `getInstallSourceInfo()` exposes it: the lock is set at install
  iff the installer declared `PACKAGE_SOURCE_LOCAL_FILE` or
  `PACKAGE_SOURCE_DOWNLOADED_FILE` (Files, browser downloads, the system
  installer screen). Store installs, `adb install` (`PACKAGE_SOURCE_OTHER`)
  and other session sources are never locked by the install; debuggability
  plays no part. Android 14+ applies the lock only on a first install for
  the user; Android 13 on every install from a file, updates included. The
  lock is a per-package app op, so it also survives updates from any source.
  `getInstallSourceInfo()` shows only the latest install, so the guide never
  depends on it; it only feeds the bridge's best guess. In PhoneCanDo's flow
  the lock comes from lite's own install from Files and carries over to full.
- Android 14+ exports the Settings activity behind that message
  (`android.settings.SHOW_RESTRICTED_SETTING_DIALOG`) without a permission;
  13 keeps it private. Started for our own package it shows the message in
  place and moves the state to acknowledged, which adds the App info item.
  It does that unconditionally, so on an app that was not locked it locks
  it; the guide always follows with "Allow restricted settings", so the
  worst case is one extra confirmation. Verified on the Moto G96, Android 16
  (`default` → `ignore`).

Since the lock cannot be read, `RESTRICTED_FLOW` (a constant in
`app/src/ui/accessibility/guide.ts`, `true`) decides the flow: release
installs always reach users as files, so the accessibility prompt and
Settings run a three-step guide, all steps visible (`StepList.tsx`) with the
current one spelled out. The whole guide lives in `app/src/ui/accessibility/`:
`guide.ts` holds the flow switch, the steps and every user-facing line, the
hook (`useAccessibilitySteps.ts`) holds state and actions, and
`AccessibilitySetup.tsx` and `AccessibilityDialog.tsx` render it in Settings
(inside `settings/PhoneControlSection.tsx`) and over the chat. Step 1 shows Android's "Restricted setting" message: in place
through `showRestrictedSettingNote()` on Android 14+, otherwise (Android 13,
an OEM that guards that screen, or a note that did not appear) by opening
Accessibility so the user taps PhoneCanDo. Step 2 opens App info
(`openAppInfoSettings()`) for "Allow restricted settings". Step 3 opens
Accessibility for the switch. Coming back to the app moves to the next step,
and each step has one-tap corrections. The guide ends when PhoneCanDo appears
in `enabled_accessibility_services` or the service binds, it is skipped once
the service has run on this install (`hasAccessibilityConnectedBefore()`; on
Android 13 a later update from a file voids that, since 13 locks again), and
it runs only on Android 13 and newer, where the lock exists. With
`RESTRICTED_FLOW` false the plain flow shows, with "Android said Restricted
setting? Show the steps" to start the guide at step 2.
`openAccessibilitySettings()` passes the Settings fragment-args extras so the
list opens scrolled to PhoneCanDo on AOSP-based builds; the per-service page
itself needs a signature permission.

### Engine stop and the way back

Before the installer screen, `installDownloaded` stops the engine
(`stopServeService`, then polls `isServeRunning` for up to 4 s) and calls
`markSelfUpdatePending()`, which stores a timestamp and the running build's
channel in the engine prefs (`commit`, since the install kills the process).
`PackageReplacedReceiver` (`MY_PACKAGE_REPLACED`, runs in the new build) acts
only when that mark exists and is under 30 minutes old, and always clears it,
so dev reinstalls, `adb install` and Play updates stay quiet. It never acts on
the play channel, and it stays quiet when the user is already back in the app
through the installer's Open button. Acting means a "PhoneCanDo updated"
notification ("switch on phone control" only for lite → full) and a launch
attempt that Android 10+ usually blocks from the background. The module's
`OnCreate` cancels that notification on every app start; each way back after
an update cold-starts the new build.

## Telemetry counters

The native half of telemetry records only and never does network.
`TelemetryRecorder.kt` is its entry point: `install` and the events counted
below. They land in `TelemetryStore.kt`: the SharedPreferences file
`phonecando_telemetry`, its keys and the one lock that every write, read and
consume holds. JS reads it through `TelemetrySnapshot.kt` with
`getTelemetrySnapshot` (a peek) or `consumeTelemetrySnapshot` (same shape;
under that lock it zeroes the counters, clears `lastExitCode`, `lastDiedAt`
and `lastBootMs` and drains the crash list). `lastStderrTail` survives a
consume: only the next unexpected exit replaces it, so a report the user
sends later, even from a new process, can still attach it. The shape is
`src/telemetry.types.ts`. A corrupt store is cleared, never thrown.

- On/off (`TelemetrySwitch.kt`): `setTelemetryEnabled` (synchronous)
  mirrors the user's choice into the same file (`telemetry_enabled`, default
  on; no reset or consume clears it). Off changes two things: the service
  no longer opens the engine event stream just to count sessions, so it
  opens only for watched chats, as before telemetry; and the engine stderr
  tail is dropped when sharing turns off and none is kept while it stays
  off, so a report sent after turning it back on never carries output from
  the off period. Counters and crash capture go on, local only (the app
  drops what it consumes while off). Turning it on while serve is healthy
  opens the stream at once; turning it off closes it unless chats are
  watched.
- Install: `TelemetryInitProvider` (manifest provider, runs before
  `Application.onCreate` in every process start) calls
  `TelemetryRecorder.install`, which installs a default uncaught-exception
  handler (`TelemetryCrashCapture.kt`) and the memory callbacks once per
  process; the module's `OnCreate` and the service's `onCreate` repeat it
  (idempotent). A crash is stored with `commit()` (id, time, class, message
  ≤200 chars, top 5 frames, thread, versionName; newest 10 kept), then
  always handed to the previous handler. Message and frames go through the
  redaction below.
- Engine (service): `starts` counts launch attempts, `startFails` a launch
  that threw, no healthy answer within 120 s, or an exit before the first
  one; `portSquats` counts `resolvePort` fallbacks. `ServeWatch.kt` (one
  daemon thread per serve) polls the same authenticated `/api/session` as
  `health` until the first 200: `lastBootMs` runs from the module's
  `startServeService` call. An exit without a stop request counts `died`
  and keeps the exit code, the time it was noticed (`lastDiedAt`) and,
  while sharing is on, the last ≤2 KB of `serve.log` (serve's stdout and
  stderr, as before; an exit that left none clears the old tail). The tail
  reads at most the last 16 KB, redacts all of it, drops the cut-off start
  (the first line, or in a line longer than 16 KB its first token and,
  after a possible credential label, the next), then keeps the last 2 KB
  on a UTF-8 boundary. It can hold prompt text, so the app sends it only in
  a user-initiated report.
- Redaction (`PathRedactor.kt`, pure; JVM tests in `src/test`,
  `./gradlew :phonecando-runner:testLiteDebugUnitTest`): a whole path
  becomes `<path>`, not just its prefix. A path starts at this app's data or
  files dir (as given and canonical), `/data/user/N`, `/data/user_de/N`,
  `/data/data`, `/data/media/N`, `/data/app`, `/storage/<any>`, `/sdcard`,
  `/mnt/<any>`, `~/`, `file://`, `content://` or a URL-encoded `/data`,
  `/storage`, `/sdcard` or `/mnt`, and runs to whitespace or one of
  `` '"`()<>[]{},; ``. A path right after an opening quote (`"`, `'` or
  `` ` ``) runs to the matching closing quote on the same line instead,
  spaces included; a backslash escapes the next character there, as in a
  JSON string. With no closing quote on the line, an unquoted path that a
  Java file-error suffix ends later on the same line runs up to it, spaces
  included: `: open failed:`, or a space and `(No such file or directory)`,
  `(Permission denied)`, `(Is a directory)` or `(Read-only file system)`
  (case-insensitive). Whichever rule ends a path, only a trailing
  `:line[:col]` (a stack frame) stays. The serve password, its Basic
  credential and the bridge token, `Authorization`/`x-api-key` values,
  Bearer/Basic credentials and common provider key shapes (`sk-…`, `gsk_`,
  `xai-`, `gh*_`, `AIza…`) become `<secret>`, also inside a path.
- Sessions: once serve is healthy, and while telemetry is on, the service
  ensures the event stream; `session.created` of a top-level session (no
  `parentID`) counts once per id. A frame for any session that is not
  watched or tracked returns at once (an in-memory copy of those ids, kept
  by the one writer of their prefs maps, so no JSON parse per frame); a
  death drops the stream unless chats are watched.
- Tool calls: `BridgeServer` counts every authorized call to a known route
  that is not a 404, keyed by route name (`notify`, `pce_act`: the path
  without its slash, `/` as `_`). The `mobile_*` names live in the plugins,
  and several tools share `/pce/act`.
- Low memory (`TelemetryMemoryCallbacks.kt`): `onTrimMemory` at
  `RUNNING_LOW`, `RUNNING_CRITICAL` or `COMPLETE`, and `onLowMemory`.
  Android 14+ delivers none of these, so the counter stays 0 there.
- Live fields (`TelemetrySnapshot.kt`, read on every call):
  `installSource` (installer package), `batteryOptIgnored`,
  `fgServiceRunning` (the `isServeRunning` check), `a11yConnected` (the
  `isUiAutomationConnected` check, false in lite/play) and `drmIdHash`, null
  while `TELEMETRY_DRM_ID_ENABLED` is false (MediaDrm is then never touched).

## Not implemented yet

- Boot receiver (note: Android 15+ forbids dataSync FGS from BOOT_COMPLETED).
- Battery-exemption prompt + health-check restart recovery.

These are tracked in `../../../docs/planning/automation.md`.
