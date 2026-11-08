# phonecando-runner (engine host)

`phonecando-runner` (`com.phonecando.runner`) is the Expo module that hosts
the agents' engines (opencode today): the agent records, the engine
supervisor and its foreground service, the loopback bridge (`bridge.md`) and
the agent config it seeds into each engine's HOME. All native code is
autolinked; `app/android/` is generated.

## Native API

- `api/AgentFunctions.kt`: `listAgents`, `createAgent({kind, name,
  imageId})`, `renameAgent`, `deleteAgent` (stops the agent's engine first;
  the image stays, JS deletes it through `phonecando-linux`). JS sees `id`,
  `kind`, `name`, `imageId` and `createdAt` (`src/engine/agents/records.ts`).
- `api/EngineFunctions.kt`: `startEngine(agentId)`, `stopEngine`,
  `stopAllEngines`, `isAnyEngineAlive`, `touchEngine`, `engineStatus`,
  `engineStatuses`, `getEngineAuth` (`{baseUrl, password}`, read at call
  time) and `engineHealth` (`ok|starting|http-N|error:…`, one probe). Every
  engine change is the `phonecandoEngineState` event (`EngineStatus`:
  `stopped|starting|ready|stopping|died|failed`, port, error, `lastUsedAt`).
  `startEngine` rejects with an `EngineStartError` code: `too_many_running`,
  `image_not_ready`, `engine_missing`, `port_unavailable` or `start_failed`.
- `api/NotifyFunctions.kt`: `consumeLaunchTarget` and `dismissAgentAlert`
  (see Notifications).
- `PhoneCanDoRunnerModule.kt`: `getPrefix`, `getBuildChannel`, the
  phone-control switch, the `phonecandoLaunchTarget` event, the bridge
  prompts (`pendingPrompts`, `resolveUnlock`, `resolveAccessibility`, event
  `phonecandoBridgePrompt`; see `bridge.md`), the accessibility guide calls,
  `canRequestPackageInstalls`, `markSelfUpdatePending`,
  `requestNotificationPermission` and telemetry.
- `agents/`: the agent-kind seam. `AgentKind` says how to launch a kind's
  engine, probe its health, read its event stream and seed its config;
  `AgentKinds` lists the kinds. opencode lives in `agents/oc/`
  (`OpencodeKind`, its launch recipe, auth and event parser). The
  supervisor, health checks, event streams and redaction go through a kind,
  never an agent name. `AgentStore` keeps the agents (`AgentRecord`) and is
  the `AgentDirectory` redaction reads. The bridge reads
  `engine/LiveAgents.kt`, the agents whose engine is starting or ready: a
  stopped agent's token gets 401, and the screen it held is free at once.
- `engine/`: the engine supervisor and what it uses (below);
  `engine/image/` reads the image files an engine needs, `engine/proc/`
  finds and ends an agent's processes.
- `notify/`: the agents' notifications, their alerts and where a tap opens
  the app (see Notifications).
- `PhoneCanDoServeService.kt`: the foreground service (`dataSync` type).
- `PackageReplacedReceiver.kt`: brings the app back after a self-update
  (see Self-update install).
- `AndroidManifest.xml`: service, receiver and `OpenTargetActivity`
  declarations plus `FOREGROUND_SERVICE*` permissions (merged at build).

## Agents

An agent is one running instance of a kind with its own name, image, port,
engine password and bridge token; it is created and deleted together with
its image. `AgentStore` keeps them in `files/state/agents.json`: every change
writes a temp file, syncs it and renames it over the old one, so a crash
mid-write leaves the previous list whole. Each agent gets a random id plus a
192-bit password and bridge token from `SecureRandom`. The token and the port
never reach JS; the password does, only through `getEngineAuth`, and JS never
stores it. The image id names `files/images/<imageId>/`, so it is short and
has no separators.

## opencode payload (v2)

Ships the native bionic opencode payload (`liboc-engine.so` + `liboc-opentui.so` as
`jniLibs` `*.so` names, `extractNativeLibs=true`): executed directly (its
INTERP is the OS linker; bionic system libs only). Payload is self-built
(`opencode v2.0.26-android-phonecando.1`: upstream + embedded web UI + pair API,
see `docs/bootstrap/oc-build.md`): staged via
`scripts/agents/oc/stage.sh` (or `./manage engine oc stage`) into module
`jniLibs`.

`agents/oc/Launch.kt` is the recipe: `liboc-engine.so serve --port <port>
--hostname 127.0.0.1` with `OPENCODE_SERVER_PASSWORD`, `OPENTUI_LIB_PATH`,
the file watcher off and opencode's own auto-update and LSP downloads off.
No model pin: fresh sessions inherit the upstream default. v2 serve is
auth-first: the health probe, the event stream, every JS call and the TUI
send HTTP Basic with the agent's password under the user `opencode`.

On an opencode/web-UI bump, recheck the embedded theme override
(`src/engine/agents/oc/web.ts`, opencode's internal `--v2-*` vars); see
`docs/bootstrap/oc-build.md` → Bumping versions.

## Engines

`EngineSupervisor` (one per process, `Engines.get`) runs one engine per
agent, several at once:

- **Start.** `startEngine` registers a request and sends `ACTION_START` to
  the service, which runs starts one at a time on its own thread. A start
  takes a seat (`EnginePolicy`: at most three engines starting or ready; a
  further start stops the least recently used ready engine that has been
  idle for a minute, and is refused with `too_many_running` when none has),
  ends processes an earlier life of this agent left behind, reads the image
  (`run/engine.env`; missing means `image_not_ready`), seeds the config,
  opens the bridge, takes a port and spawns. The call resolves with the port
  once the process runs; an engine already starting or ready answers at
  once.
- **Ready.** `EngineWatch` (one thread per process) polls the kind's health
  probe with the agent's password: 200 marks it ready (boot time to
  telemetry); 401 means another engine answers on that port, so it is
  relaunched on an OS-assigned port (twice at most, then
  `port_unavailable`); no answer within 120 s fails the start and stops it.
- **Ports.** `PortAllocator` gives the agent's last-good port (kept in its
  record) when it is free and not handed out, else an OS-assigned free
  loopback port, and reserves it until the engine is gone, so two starts
  never share one. Ports are plumbing, never shown.
- **Environment** (`EngineEnv`): our own process env, then the image's
  `engine.env` (HOME, TMPDIR and, for a Linux image, SHELL, PATH,
  `PHONECANDO_IMAGE` and `MAKEFLAGS`), then the kind's launch env, then ours on top:
  `PHONECANDO_BRIDGE_URL` and this agent's `PHONECANDO_BRIDGE_TOKEN` (only
  while the bridge is up), `PHONECANDO_CHANNEL` and, last,
  `PHONECANDO_AGENT=<agentId>`. The engine runs from the native-library dir
  with cwd = HOME; its stdout and stderr go to `<image>/logs/engine.log`.
- **Stop.** SIGTERM to the engine and to every process of our uid whose
  `/proc/<pid>/environ` carries its `PHONECANDO_AGENT` tag, a wait of up to
  3 s (tagged processes that appear meanwhile get SIGTERM too), then SIGKILL
  to the rest (`engine/proc/`). Everything an engine starts inherits the
  tag, so this also ends shells, language servers and proot it left behind,
  and engines from an earlier app process. Stopping every agent takes the
  same one wait.
- **Death.** An exit nobody asked for marks the engine `died` and drops its
  process, so the next start launches it again. Nothing restarts it by
  itself.

JS starts engines through `src/engine/ensureEngine.ts` (one start in flight
per agent; a ready engine is only marked used) and reaches them through
`src/engine/connection.ts` (address and password read at call time,
`waitForEngine` for a fresh start).

## Foreground service and lifetime

`PhoneCanDoServeService` anchors the engines while the app is in the
background. It runs the start requests, shows one notification that lists
the chats the agents are busy with (`notify/ServiceNotification.kt`, channel
`phonecando-engine`; see Notifications) and stops itself once nothing
runs. Every command answers
`START_NOT_STICKY` and a null-intent restart starts nothing.

Lifetime is quiet-when-idle and follows the UI. `App.tsx` starts the active
agent's engine on launch and on every return to the foreground
(`src/state/agents.ts` `startAgent`: prepare its image, then
`ensureEngine`); the web UI and the terminal start it when they open; other
agents' engines start only when something uses them. When the app goes to
the background, `stopIdleAgents` stops each running engine whose kind says
it is idle (opencode: no session moved in the last minute) or that does not
answer; it does nothing while phone control is unlocked, so an agent driving
another app is not cut off. A start, a chat in front (`useEngineTouch`,
every two minutes), each bridge call and, while usage stats are on, each
engine event (the stream exists only then) mark an engine used, so it is
not the one stopped to make room.

Android 15+ lets a `dataSync` foreground service run 6 hours in any 24
while the app is in the background; bringing the app to the foreground
resets the clock. At the limit Android calls `onTimeout(startId, fgsType)`
and crashes the whole process unless the service stops within seconds. The
service therefore removes its notification, calls `stopSelf()`, then stops
every engine on its own thread (one 3 s grace for all); the bridge closes
with the last engine. Nothing restarts them in the background; the app
starts the active agent's engine again when it next comes to the
foreground.

## Notifications

Everything an agent posts goes on the `phonecando-agent` channel through
`notify/AgentNotices.kt`, tagged with the agent's id, so one agent's
notification never replaces another's. Per agent, one slot (id 4500)
holds its "come back to me" notice, the `/app` return notice or an alert
(below), so there is never more than one; its own posts (`/notify`) take
4600-8695, one per title, and its prompts 9000-9255. The engine service
(4101) and the update notice (4202) are untagged.

- **Where a tap lands.** A `LaunchTarget` is a footer tab plus, when the
  reason is one agent, that agent. Every agent notification's tap, the
  single-agent engine notification and the bridge's own launch start
  `notify/OpenTargetActivity` (non-exported, `Theme.NoDisplay`,
  `noHistory`) with the target in its intent; it hands the target over
  (`LaunchTargets.deliver`: the runner prefs plus the
  `phonecandoLaunchTarget` event `{tab, agentId}`), starts the app and
  finishes in `onCreate`. So the target is bound when the app opens, and two
  agents' notifications each open their own agent. Each target's intent
  carries its own `Intent` identifier (part of `filterEquals`, API 29+), so
  every target gets its own `PendingIntent`. The app reads the target from
  the event, or with `consumeLaunchTarget` (read and cleared once) on launch
  and on every return to the foreground once the agents are read
  (`App.tsx`), makes the agent active when it exists and shows the tab. A
  trampoline rather than an Expo activity listener on `MainActivity`:
  Android recreates an activity after its process died with the intent that
  first created it, and `MainActivity` hands React a null saved state, so a
  listener would replay an old tap; the trampoline reads each tap once and
  is never restored. Recents replays (`FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`)
  carry no target.
- **The service notification lists chats, not engines.** One line per
  chat: its title, then its agent, then its state ("Working", "Waiting for
  your answer", "Stopped with an error", "Done"), waiting first and newest
  first within a state; collapsed, the counts ("1 waiting for your answer ·
  2 working"), and only the counts on the lock screen (public version). With
  no chat, "No chats running". `notify/ChatBoard.kt` (pure, JVM tests) keeps
  the board from the same events as the alerts: a top-level session shows
  from its first activity; done and error stay until the user opens that
  agent's chat (`dismissAgentAlert`) or its engine stops or dies, at most
  four of them; a run the user stops (`STOPPED`: opencode
  `session.execution.interrupted`) or a deleted session leaves; a subagent's
  child session shows only while it waits for an answer. The chat on screen
  is left out: the app reports it (`setOpenChat`, from `useOpenChat.ts`:
  the web UI on a chat, Home tab with nothing over it, app in the
  foreground; nulls otherwise), a run that ends while it is open counts as
  seen, and opening a done or error chat sees it. An agent TUI in front
  reports its chat by the title it gives the terminal
  (`ui/terminal/useOpenTuiChat.ts`, the kind's `tuiChatTitle`: opencode
  writes `OC | <title>`, cut to 37 characters and "…" past 40); the board
  hides it only when exactly one of that agent's chats fits, so a fresh
  untitled chat or two with the same title stay listed; a title that fits
  none makes the tracker read that agent's titles again.
  `notify/ChatTracker.kt` reads titles from the engine (`AgentKind.sessionInfo`:
  opencode `GET /api/session/{id}`, `data.title`; the stream carries a
  title only on create and rename) when a chat first shows, starts a new
  run and finishes, one loopback GET at a time on its own thread; a rename
  (opencode `session.renamed`, often after the first run has ended) updates
  it straight from the stream; a chat without one yet reads "New chat". The service re-renders only when the
  board changes (`Engines.Listener.onChats`), never per token. A tap opens
  the app, on that agent's Home when every listed chat is one agent's.
- **Agent alerts.** `EngineStreams` passes every engine event to
  `notify/AgentAlerts.kt`; `notify/AlertRules.kt` (pure, JVM tests) decides.
  A top-level session's verdict (`FINISHED`, `FAILED`) and any session
  waiting on the user (`WAITING`: opencode `permission.asked`,
  `form.created`) alert; a subagent's child session (its `session.created`
  has a parent) never alerts on its verdict; an interrupted run
  (`STOPPED`) never alerts; the same alert for the same session comes once until that session
  moves again. Nothing posts while PhoneCanDo is in front (an activity on
  screen). The alert goes in the agent's slot, titled with its name:
  "Finished. Tap to see the result.", "Stopped with an error. Tap to see what
  happened." or "Waiting for your answer."; a new one replaces the last and
  makes no sound while the last is still showing. A tap opens the agent's
  Home; showing that agent's chat takes it down (`dismissAgentAlert`, from
  `useEngineTouch`: a call of its own, since `touchEngine` also runs for
  engine starts that show nothing). A new engine life starts with fresh
  rules for the agent; deleting an agent takes down all its notifications.

## Agent images (engine side)

Every engine runs in its agent's image, `files/images/<imageId>/`.
`phonecando-linux` creates and fills it (see
`../../../docs/overview/architecture.md` → Linux runtime); this module only
reads the parts an engine needs (`engine/image/ImageDir.kt`, the layout of
`lre/api` `ImageLayout`, read directly so the runner never depends on
`lre/`): `home/` (the engine's HOME: agent config, the agent's database,
projects, keys), `tmp/`, `logs/`, `run/engine.env` and `run/os-note.md`.
Before a start (unless the engine is already ready) JS runs
`prepareImageForStart`, the image's cheap per-start refresh; a failure there
answers `image_not_ready`.

## Agent config seeding

Each kind's source lives under `phonecando-runner/agents/<kind>/`
(opencode: `agents/oc/config/`, plus `config-lite/` for the non-full
channels). Kind-neutral code lives in `agents/shared/` (the phone tools,
`agents/shared/phone-tools/`) and is packaged inside each kind's config
(`oc-config/phone-tools/`), so a kind's plugins import it by a relative path;
the full-only `control/` part is dropped outside full. The module's Gradle
`syncAgentConfig<Variant>` task packages it into generated Android assets at
build time (opencode: the `oc-config` assets folder; a future iOS
implementation can copy the same directory).
`ConfigSeeder` writes it to the kind's config dir under the image HOME on
every engine start (opencode: `home/.config/opencode/`): plugins, the phone
tools, skills and `AGENTS.md` refresh, `opencode.json` is seeded only when
absent so edits and BYOK keys survive. A manifest of the seeded files
(`.phonecando-seeded`) lets the next start delete files we no longer ship,
so a renamed plugin never loads twice; user files are never touched. Then
the image's `run/os-note.md` (OS, package manager, no systemd) is written
between two marker lines at the end of the kind's instructions file
(opencode: the global `AGENTS.md`), replaced on every start (`OsNote`). A
failed seed never blocks a start.

v2 loads **`plugins/<id>/index.ts`** (`@opencode/plugin`, `Plugin.define` +
`ctx.tool.transform`), auto-discovered from the global config dir and from
`<project>/.opencode/plugins/`; V1 `tools/*.ts` and `@opencode-ai/plugin` do
not load (intentional v2 breaking change, verified on device).

## Build channels

One codebase, three APKs as Gradle product flavors: `full`
(`pnpm android:full`) ships the automation driver and self-update; `lite`
(`pnpm android:lite`) keeps self-update without the driver; `play`
(`pnpm android:play`) has neither. Full and lite also carry the Linux
runtime (`phonecando-linux`); play has none. One prebuild serves every
flavor. Full mechanics, permissions and tool gating are in `bridge.md`; the
PCE host is in `automation.md`.

Build a signed channel APK with `./manage build lite|full` (repo root); the
script audits lite for no accessibility service and no PCE classes, and full
for the opposite. `./manage release <version>` builds both and drafts the
GitHub release (`../../../docs/release/android.md`).

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

Before the installer screen, `installDownloaded` stops every engine
(`stopAllEngines`, which resolves once no engine and no tagged process is
left, then polls `isAnyEngineAlive` for up to 4 s) and calls
`markSelfUpdatePending()`, which stores a timestamp and the running build's
channel in the runner prefs (`phonecando-engine`; `commit`, since the
install kills the process).
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
  on; no reset or consume clears it). Off changes two things: the
  supervisor opens no engine event stream (they exist only to count
  sessions), and the engine stderr tail is dropped when sharing turns off
  and none is kept while it stays off, so a report sent after turning it
  back on never carries output from the off period. Counters and crash
  capture go on, local only (the app drops what it consumes while off).
  Turning it on opens the stream of every ready engine at once; turning it
  off closes them all.
- Install: `TelemetryInitProvider` (manifest provider, runs before
  `Application.onCreate` in every process start) calls
  `TelemetryRecorder.install`, which installs a default uncaught-exception
  handler (`TelemetryCrashCapture.kt`) and the memory callbacks once per
  process; the module's `OnCreate` and the service's `onCreate` repeat it
  (idempotent). A crash is stored with `commit()` (id, time, class, message
  ≤200 chars, top 5 frames, thread, versionName; newest 10 kept), then
  always handed to the previous handler. Message and frames go through the
  redaction below.
- Engines (any agent): `starts` counts launch attempts, `startFails` a
  launch that threw, no healthy answer within 120 s, or an exit before the
  first one; `portSquats` counts a last-good port that could not be used and
  a relaunch after another engine answered on the port. `EngineWatch.kt`
  (one daemon thread per engine process) polls the kind's authenticated
  health probe (opencode: `/api/session`) until the first 200:
  `lastBootMs` runs from the module's `startEngine` call. An exit without a
  stop request counts `died` and keeps the exit code, the time it was
  noticed (`lastDiedAt`) and, while sharing is on, the last ≤2 KB of that
  agent's `<image>/logs/engine.log` (the engine's stdout and stderr; an exit
  that left none clears the old tail). The tail reads at most the last
  16 KB, redacts all of it, drops the cut-off start (the first line, or in a
  line longer than 16 KB its first token and, after a possible credential
  label, the next), then keeps the last 2 KB on a UTF-8 boundary. It can
  hold prompt text, so the app sends it only in a user-initiated report.
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
  `:line[:col]` (a stack frame) stays. Every agent's engine password (in
  every form its kind knows; opencode: the raw value and its Basic
  credential) and bridge token, `Authorization`/`x-api-key` values,
  Bearer/Basic credentials and common provider key shapes (`sk-…`, `gsk_`,
  `xai-`, `gh*_`, `AIza…`) become `<secret>`, also inside a path; one
  engine's log or a crash can carry another agent's secrets, so all of them
  are replaced.
- Sessions: the supervisor keeps one event stream per ready engine
  (`EngineStreams`), whatever the usage-stats switch says: any event the
  kind maps to activity marks the engine used, so a long run nobody watches
  is never the idle engine stopped to make room, and every event feeds the
  agent alerts (see Notifications). Only while usage stats are on,
  `session.created` of a top-level session (no `parentID`) counts once per
  agent and session id, so a frame seen again after a reconnect does not
  count twice.
- Tool calls: `bridge/BridgeServer.kt` counts every authorized call to a
  known route that is not a 404, keyed by `Route.telemetryKey` in
  `bridge/Routes.kt` (`notify`, `pce_act`: the path without its slash, `/`
  as `_`). The `mobile_*` names live in the phone tools, and several tools
  share `/pce/act`.
- Low memory (`TelemetryMemoryCallbacks.kt`): `onTrimMemory` at
  `RUNNING_LOW`, `RUNNING_CRITICAL` or `COMPLETE`, and `onLowMemory`.
  Android 14+ delivers none of these, so the counter stays 0 there.
- Live fields (`TelemetrySnapshot.kt`, read on every call):
  `installSource` (installer package), `batteryOptIgnored`,
  `fgServiceRunning` (true while any agent's engine is starting, ready or
  stopping), `a11yConnected` (the `isUiAutomationConnected` check, false in
  lite/play) and `drmIdHash`, null while `TELEMETRY_DRM_ID_ENABLED` is false
  (MediaDrm is then never touched).

## Not implemented yet

- Boot receiver (note: Android 15+ forbids dataSync FGS from BOOT_COMPLETED).
- Battery-exemption prompt, and restarting an engine that died by itself
  (the next start relaunches it).

These are tracked in `../../../docs/planning/automation.md`.
