# phonecando-runner (engine host)

`phonecando-runner` (`com.phonecando.runner`) is the Expo module that hosts
the agents' engines: the agent records, the engine supervisor and its
foreground service, the loopback bridge (`bridge.md`), agent installs and
the config it seeds into each engine's HOME.

## Native API

- `api/AgentFunctions.kt`: `listAgents`, `createAgent({kind, name,
  imageId})`, `renameAgent`, `deleteAgent` (stops the agent's engine first;
  the image stays, JS deletes it through `phonecando-linux`). JS sees `id`,
  `kind`, `name`, `imageId`, `createdAt`, `installedVersion` (null before
  an install is recorded) and `needsInstall` (its kind has an install and
  none is recorded) (`src/engine/agents/records.ts`).
- `api/EngineFunctions.kt`: `startEngine(agentId)`, `stopEngine`,
  `stopAllEngines`, `isAnyEngineAlive`, `touchEngine`, `engineStatus`,
  `engineStatuses`, `isEngineIdle` (the kind's idle rule, see Foreground
  service and lifetime) and `engineHealth` (`ok|starting|http-N|error:…`,
  one probe; a TUI engine answers by its state). Every engine change is the
  `phonecandoEngineState` event (`EngineStatus`:
  `stopped|starting|ready|stopping|died|failed`, port (null for a TUI
  engine), error, `lastUsedAt`). `startEngine` resolves `{port}` (null for a
  TUI engine); an engine already starting or ready, of either style,
  resolves at once without a relaunch. It rejects with an
  `EngineStartError` code: `too_many_running`, `image_not_ready`,
  `engine_missing`, `port_unavailable`, `start_failed` or
  `agent_not_installed` (see Installing an agent).
- `api/InstallFunctions.kt`: installing an agent's kind into its image
  (see Installing an agent), all synchronous: `guestUnset(agentId)` →
  the env names its image keeps from guests, `installPlan(agentId,
  family)` and `updatePlan(agentId, family)` → `{script, timeoutSec,
  phases}` or null, `versionCheck(agentId)` → `{argv, pattern}` or null,
  and `recordInstall(agentId, versionOutput)` → `{version}`. A refusal is
  an error whose code, also the start of its message, is `no_recipe` or
  `verify_failed`.
- `api/EngineTerminalFunctions.kt`: a TUI engine's terminal (see TUI
  engines): `engineTerminalAttach(agentId)` → `{viewerId, rows, cols}`
  (the PTY's size now; `not_running` when the agent's engine is not a
  starting or ready TUI engine), `engineTerminalRead(viewerId, max)` →
  base64 or null (nothing pending; max is capped at 64 KiB),
  `engineTerminalWrite(viewerId, base64)`,
  `engineTerminalResize(viewerId, rows, cols)` and
  `engineTerminalDetach(viewerId)`. All synchronous; a refusal is an error
  whose code, also the start of its message, is `not_running`, `ended` or
  `detached`.
- `api/KindFunctions.kt`: `listKinds` (a JSON array of `KindView`,
  `agents/kit/ts/contract/view.ts`: id, label, version, type, channels,
  stability, `origin` (`bundled|user`), `isDefault`, `home`, the web adapter
  spec and the `chatTitle` pattern verbatim (a TUI engine's
  `surfaces.chatTitle`, a server's TUI client's `surfaces.terminal.chatTitle`),
  `signIn`, `requiresLinux`, `families` (`install.families`, else every
  family, cut down to those each runtime it needs installs on; null for
  any), `runtimes` (the runtime ids it needs), `hasInstall` and
  `payloadPresent` (a native kind: every lib its payload lists is in the
  native-library dir; an image kind: true); never a template or a
  secret),
  `pairWebUi(agentId)` (the web UI's one-time sign-in URL, see opencode
  payload) and `clientRecipe(agentId, projectDir, sessionId?)` (`{cmd, env,
  cwd}`, the kind's TUI attached to the agent's engine).
- `api/NotifyFunctions.kt`: `consumeLaunchTarget` and `dismissAgentAlert`
  (see Notifications).
- `PhoneCanDoRunnerModule.kt`: `getPrefix`, `getBuildChannel`, the
  phone-control switch, the `phonecandoLaunchTarget` event, the bridge
  prompts (`pendingPrompts`, `resolveUnlock`, `resolveAccessibility`, event
  `phonecandoBridgePrompt`; see `bridge.md`), the accessibility guide calls,
  `canRequestPackageInstalls`, `markSelfUpdatePending`,
  `requestNotificationPermission` and telemetry. `pendingPrompts` also
  lists the agents' links to open, which `resolveOpenUrl` ends (see
  Notifications).
- `agents/`: the agent-kind seam. `AgentKind` (in `agents/kit/kotlin/api`,
  package `com.phonecando.agents.kit`) says how to launch a kind's engine,
  probe its health, read its event stream and seed its config. A kind is
  its manifest: `KindCatalog` reads every packaged `agents/<id>/agent.json`
  from the APK assets once per process (`KindCatalogs`, on first use),
  decodes it (`agents/kit/kotlin/manifest`) and makes a `ManifestKind`
  (`agents/kit/kotlin/render`) with the kind's code hooks from
  `BuiltinHooks` (`agents/builtin/kotlin`). Then it reads the user's kinds
  from `files/state/agent-kinds/user/<id>.json` (rules: `agents/AGENTS.md`
  → Engine styles); a kind added later loads with the next app process. A
  kind that cannot load (a bad manifest, a broken user rule, a hook or
  runtime this build lacks) is left out and logged. `RuntimeCatalog`
  (`RuntimeCatalogs`) reads the packaged runtime plugins
  (`agents/runtimes/<id>/`, full and lite only) first, so each kind is
  bound to the runtimes it needs. The runner never imports a kind: the
  supervisor, health checks, event streams and redaction go through a
  kind, never an agent name. `AgentStore` keeps the agents
  (`AgentRecord`) and is the `AgentDirectory` redaction reads. The bridge
  reads `engine/LiveAgents.kt`, the agents whose engine is starting or
  ready: a stopped agent's token gets 401, and the screen it held is free
  at once.
- `engine/`: the engine supervisor and what it uses (below);
  `engine/image/` reads the image files an engine needs, `engine/proc/`
  finds and ends an agent's processes (`EngineProcess`: an engine's own
  process, whatever started it), `engine/spawn/` starts an engine by its
  style, `engine/ready/` says when it is ready, `engine/tui/` is a TUI
  engine's terminal and viewers.
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
192-bit password and bridge token from `SecureRandom`. The token never
reaches JS, and the password only inside the TUI client's recipe
(`clientRecipe`), which JS hands to the PTY without storing it. The image id
names `files/images/<imageId>/`, so it is short and has no separators.
`ranBefore` turns true the first time the agent's engine is ready; from
then on a launch adds the kind's resume args (`engine.resume`).
`installedVersion` is what its kind's install put in its image (see
Installing an agent).

## opencode (the native kind)

Its payload (`liboc-engine.so`, `liboc-opentui.so`) ships as `jniLibs`
(`extractNativeLibs=true`) and runs directly: INTERP is the OS linker,
bionic system libs only. Build and stage: `agents/native/opencode/docs/`.

Its `agent.json` is the recipe: `liboc-engine.so serve --port <port>
--hostname 127.0.0.1` with `OPENCODE_SERVER_PASSWORD`, `OPENTUI_LIB_PATH`,
the file watcher, auto-update and LSP downloads off, and no model pin. v2
serve is auth-first (`engine.auth.basic`): the health probe, event stream,
chat-title read, pairing and TUI send HTTP Basic with the agent's password
(user `opencode`). The web UI signs in natively (`pairWebUi`): `POST
/api/pair` mints a single-use code, and `/auth/connect/<code>` redeems it
in the WebView; a 401 retries once with the password read again. Its one
code hook is the SSE event parser (`opencode.events`).

## Engines

`EngineSupervisor` (one per process, `Engines.get`) runs one engine per
agent, several at once, of either engine style (`agents/AGENTS.md` →
Engine styles): a **server** (opencode) is a process serving HTTP on its
own loopback port, a **TUI** is the kind's own TUI on a PTY of ours (see
TUI engines). The supervisor works over three seams, so the style matters
only where it must: `EngineProcess` (`engine/proc/`: `ServerProcess`, a
plain process, or `TuiProcess`, a program on a PTY), `ReadyProbe`
(`engine/ready/`: `HttpReady`, or a TUI's `OutputReady`/`AliveReady`) and
`EventSource` (the SSE stream, or a TUI's output signals); the spawners
are `engine/spawn/` (`ServerSpawner`, `TuiSpawner`).

- **Start.** `startEngine` registers a request and sends `ACTION_START` to
  the service, which runs starts one at a time on its own thread. A start
  is refused with `agent_not_installed` while the agent's install is
  owed (see Installing an agent), then takes a seat (`EnginePolicy`: at
  most three engines starting or ready; a further start stops the least
  recently used ready engine that has been idle for a minute, and is
  refused with `too_many_running` when none has),
  ends processes an earlier life of this agent left behind, reads the image
  (`run/engine.env`; missing means `image_not_ready`), seeds the config,
  opens the bridge, takes a port (a server engine only) and spawns. The
  launch adds the kind's resume args once the agent ran before. The call
  resolves with the port (null for a TUI) once the process runs; an engine
  already starting or ready answers at once.
- **Ready.** `EngineWatch` (one thread per process) asks its `ReadyProbe`.
  A server's is the kind's health probe with the agent's password: 200
  marks it ready (boot time to telemetry); 401 means another engine answers
  on that port, so it is relaunched on an OS-assigned port (twice at most,
  then `port_unavailable`); no answer within 120 s fails the start and
  stops it. A TUI's follows the manifest's `readiness` (see TUI engines).
- **Ports.** `PortAllocator` gives the agent's last-good port (kept in its
  record) when it is free and not handed out, else an OS-assigned free
  loopback port, and reserves it until the engine is gone, so two starts
  never share one. Ports are plumbing, never shown.
- **Environment** (`EngineEnv`): our own process env, then the image's
  `engine.env` (HOME, TMPDIR and, for a Linux image, SHELL, PATH,
  `PHONECANDO_IMAGE` and `MAKEFLAGS`), then the kind's launch env, then ours on top:
  `PHONECANDO_BRIDGE_URL` and this agent's `PHONECANDO_BRIDGE_TOKEN` (only
  while the bridge is up), a TUI engine's `PHONECANDO_EVENTS` (see TUI
  engines), `PHONECANDO_CHANNEL` and, last, `PHONECANDO_AGENT=<agentId>`. A server engine runs from the
  native-library dir with cwd = HOME; its stdout and stderr go to
  `<image>/logs/engine.log`.
- **Stop.** SIGTERM to the engine (a TUI's terminal is hung up instead)
  and to every process of our uid whose `/proc/<pid>/environ` carries its
  `PHONECANDO_AGENT` tag, a wait of up to 3 s (tagged processes that appear
  meanwhile get SIGTERM too), then SIGKILL to the rest (`engine/proc/`). Everything an engine starts inherits the
  tag, so this also ends shells, language servers and proot it left behind,
  and engines from an earlier app process. Stopping every agent takes the
  same one wait.
- **Death.** An exit nobody asked for marks the engine `died` and drops its
  process, so the next start launches it again; a TUI that exits 0 just
  stopped (`stopped`, no error). Nothing restarts it by itself.

### TUI engines

A kind with `engine.style: "tui"` runs its own TUI as its engine, on a PTY
of the terminal module's process-wide `PtyHost`
(`phonecando-terminal`, `terminal.md`), so it keeps running when you leave
the tab or the app (the foreground service holds it like any engine) and
survives a JS reload. The Home tab shows it (`home: "tui"`).

- **Launch** (`TuiSpawner`): a cooked tty, as a terminal emulator gives
  (a raw start drops every carriage return), 24×80 until a viewer resizes
  it, in `launch.cwd` (default HOME), with the server engine's layered
  environment plus `TERM`, `COLORTERM` and `LANG=C.UTF-8` under the kind's
  env, `PHONECANDO_AGENT` included. A native TUI kind runs from the
  native-library dir. An image kind runs in its image as `<image>/shims/sh
  -c 'cd <cwd> || exit; exec "$0" "$@"' <argv…>`, on a PTY handed on to the
  guest (`handOver`, as for the Linux shell); an image without Linux has no
  `shims/sh` (`image_not_ready`). It sees only guest paths (kit-render
  `ImageLaunch`): `{{home}}` and `{{projectDir}}` are `/root`, `{{tmp}}`
  is `/tmp`, and its runtimes live under `/root`, so the host's spelling of
  HOME never reaches its trusted folders or per-folder chats.
- **Output** (`engine/tui/EngineTerminal.kt`) always drains, on the PTY's
  reader thread, whether or not anyone watches: into a ScreenRing (kit-term,
  about 1 MiB, trimmed at the last full clear, reset or alternate-screen
  entry, cut only between whole sequences and characters), through the
  SignalScanner (kit-term) to the engine's events, and to the viewer.
- **Readiness**: `output` (after its first output and then `settleMs` of
  quiet, by default 400 ms; a start with none within `timeoutSec`, 60 s,
  fails) or `alive` (after running `ms`, by default 1 s). An exit before
  is a failed start.
- **Exit**: 0 is `stopped`; anything else is `died`, with the redacted tail
  of the ring as the crash tail (telemetry keeps it only for a report you
  send, like an engine log's). A stop hangs the terminal up (SIGHUP to its
  group) and reaps its tagged processes as for any engine.
- **Viewers** (`engine/tui/TerminalViewers.kt`, the `engineTerminal*`
  functions): one at a time, the last attach wins and the one before reads
  `detached`. A viewer's first reads are the replay: a prologue that resets
  the terminal and sets the modes in effect where the ring starts (the
  alternate screen, cursor visibility, application cursor keys, bracketed
  paste, mouse reporting) and the window title, then the ring; then live
  output. A viewer that stops reading (the Home tab paused off screen) is
  bounded: past 2 MiB queued, its queue becomes a fresh replay. After the
  engine stops or dies, a viewer reads what is left, then `ended`. Writes
  and resizes from a viewer that is not the current one do nothing; a
  resize to the same size still makes the program repaint.
- **Events** (`engine/tui/TuiEvents.kt`): the kind's `events[].pty.rules`
  (kit-term `SignalRules`) turn bells and OSC 9 / 9;4 / 777 notices into
  `working|waiting|finished|failed` for the TUI's one chat (session `tui`),
  which go to the agent's alerts and the chat board like a server's; the
  window title (OSC 0/2) through `surfaces.chatTitle` is that chat's title,
  with or without a viewer. The events file adds to them (below).
- **Events file** (`engine/events/`): every start of a TUI engine seeds
  the kit's two scripts (`agents/kit/scripts/`) into
  `<home>/.phonecando/bin/` (mode 755, replaced whole) and empties
  `<home>/.phonecando/events`, whose path the engine gets as
  `PHONECANDO_EVENTS` (`KitFiles`; `/root/…` for an image kind). An image
  kind also gets `BROWSER` = that `phonecando-open` unless its env sets
  one. `phonecando-event <name> [message]` appends
  `<name>\t<session>\t<message>`, `phonecando-open <url>` appends
  `@open\t<url>`; lines are at most 4 KiB (a longer one is dropped whole).
  While the engine is ready, `EventFileTail` reads new whole lines every
  500 ms (one thread for all engines; a file that got shorter is read
  from its start). `EventSink` maps a name through `events[].hook.map` to
  `working|waiting|finished|failed` for the TUI's one chat; an unmapped
  name does nothing. An `@open` line becomes an `open_url` prompt (see
  Notifications).
- **Idle**: `idle.from: ["output"]` makes PTY output the activity: no
  output for `quietSec` is idle (`isEngineIdle`), and output marks the
  engine used for the seat policy.
- **Resume**: `ranBefore` (the agent's record) is set the first time an
  engine is ready; a relaunch after that (an eviction, a restart) adds
  `engine.resume.args` at `at`, or at the end. A launch with them that
  exits other than 0 before it is ready may have had nothing to resume
  (`claude --continue` in a folder without a chat), so it is launched once
  more without them, as the same start (`ResumeFallback`: logged, counted
  as one start and no death).
- **Stale runs**: hooks may never say a run ended (Claude Code's Esc fires
  none), so for a kind with `events[].hook` a run left `working` that has
  shown nothing for 30 s (`TuiEvents.quiet`, checked every 5 s) ends as
  stopped and leaves the chat board.

JS starts engines through `src/engine/ensureEngine.ts` (one start in flight
per agent; a ready engine is only marked used) and waits for a fresh start
with `waitForEngine` (`src/engine/connection.ts`). It never talks to an
engine itself: the web UI's sign-in URL and the TUI's recipe come from this
module (`pairWebUi`, `clientRecipe`).

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
the background, `stopIdleAgents` stops each running engine that is idle by
its kind's rule (`isEngineIdle`, the manifest's `idle`: no activity event
for `quietSec`, 60 s for opencode; an engine with none since its start is
idle); it does nothing while phone control is unlocked, so an agent driving
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
4600-8695, one per title, its prompts 9000-9255 and its links to open
9300-9363. The engine service (4101) and the update notice (4202) are
untagged.

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
  (`ui/terminal/useOpenTuiChat.ts`, the kind's `chatTitle`: opencode
  writes `OC | <title>`, cut to 37 characters and "…" past 40); the board
  hides it only when exactly one of that agent's chats fits, so a fresh
  untitled chat or two with the same title stay listed; a title that fits
  none makes the tracker read that agent's titles again.
  `notify/ChatTracker.kt` reads titles from the engine (the manifest's
  `chats.title`: opencode `GET /api/session/{id}`, `/data/title`; the stream carries a
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
- **Links to open** (`prompts/`): an `@open` line in a TUI engine's events
  file (`phonecando-open`, for a sign-in) becomes an `open_url` prompt
  when the link is http or https, at most 2 KiB, without whitespace or
  control characters, and has a host (`OpenUrl`; the host is where it
  goes, after any user info). The app sees it beside the bridge's prompts
  (`pendingPrompts`, the `phonecandoBridgePrompt` event) with `url` added,
  and ends it with `resolveOpenUrl(requestId, action)`: `open` (the app
  opened it), `copy` (we put it on the clipboard; false when that failed)
  or `dismiss`. Nothing waits on the answer. We never open a link
  ourselves. While PhoneCanDo is not in front it is also a notification
  ("Wants to open <host>. Tap to review.") that opens the agent's Home and
  goes when the prompt ends. The same link from the same agent while one
  waits adds nothing; an agent keeps at most four (a new one pushes out
  its oldest), and its links go when its engine stops.

## Agent images (engine side)

Every engine runs in its agent's image, `files/images/<imageId>/`.
`phonecando-linux` creates and fills it (see
`../../../docs/overview/architecture.md` → Linux runtime); this module only
reads the parts an engine needs (`engine/image/ImageDir.kt`, the layout of
`lre/api` `ImageLayout`, read directly so the runner never depends on
`lre/`): `home/` (the engine's HOME: agent config, the agent's database,
projects, keys), `tmp/`, `logs/`, `run/engine.env` and `run/os-note.md`.
Before a start (unless the engine is already ready) JS runs
`prepareAgentImage(agent)` (`src/state/agents.ts`): the image's cheap
per-start refresh (`prepareImageForStart`) with the env names the image
keeps from guests (`guestUnset(agentId)`); a failure there answers
`image_not_ready`.

## Installing an agent

A kind with an `install` block (`agents/AGENTS.md`) is installed into each
of its agents' images before the agent starts, and only into that image:
its runtimes (`requires.runtimes`, plugins in `agents/runtimes/<id>/`),
the packages for the image's family, its steps, then its version check.
The runner renders (`agents/install/AgentInstalls.kt` over kit-render
`ManifestKind`); JS runs and records (`src/state/flows/installAgent.ts`):

- `installPlan(agentId, family)` / `updatePlan`: one POSIX sh script for
  the guest's `sh -s` that prints `@phase <name>` before each of `phases`
  (`runtime:<id>` per runtime, skipped when its check passes; `packages`;
  `install` or `update`; `verify`), with HOME the image home (`{{home}}`
  is `$HOME`) and the runtimes' paths first on PATH. Null when the kind
  has no install (or no update). `no_recipe` when the family (`""`: one we
  do not know) is not one the kind and each runtime install on, or a
  runtime is missing from this build.
- The script's job events (phonecando-linux `guest/`) come about once a
  second even while it prints nothing:
  - `phase`;
  - `retry` (`{attempt, max}`, from the renderer's `@retry <phase> <n>/<max>`
    line, n the attempt about to start; until the next phase). Marker
    lines stay out of `tail`, and a retry starts `tail` afresh, so the
    screen shows the new try while the log keeps the failed one;
  - `elapsedSec`;
  - `downloadedBytes` and `rateBytesPerSec` (~3 s): the whole app's
    `TrafficStats` receive count since the start, null where Android
    cannot count;
  - `online` (`AndroidHost.online`: an active network that offers the
    internet; null when Android won't say).

  The install view (`ui/env/logic/installText.ts`) turns them into "No
  network", "Downloading … · rate", "Still working" and "trying again
  (2 of 3)".
- `versionCheck(agentId)`: argv `sh`, `-c`, a script that puts the
  runtimes' paths first on PATH and execs `"$0" "$@"` with stderr on
  stdout (kit-render `ImageLaunch.script`, as an image kind's engine
  starts), then the check's argv; `{{home}}` is `/root`, where the image
  binds its home and the HOME guest commands run with. So a
  `#!/usr/bin/env node` program finds node, an absolute path runs and a
  version on stderr is read; phonecando-linux runs it as given and reads
  stdout.
- `recordInstall(agentId, output)`: group 1 of the check's pattern in the
  output becomes the agent's `installedVersion` (`verify_failed` when it
  matches nothing; a kind without a check records `installed`).
- `startEngine` refuses `agent_not_installed` while the kind has an
  install and the agent has no `installedVersion` (`InstallGate`); a kind
  without one starts as before.
- `guestUnset(agentId)` (kit-render `GuestEnvPolicy`): a native kind's
  bridge URL and token and every env value it fills with a secret; an
  image kind's own engine is the guest and keeps them (lre unsets `LD_*`
  on top).

## Agent config seeding

Each kind's config source lives in its folder under `agents/` (opencode:
`agents/native/opencode/config/`, plus `config-lite/` for the non-full
channels), described by the `config` block of its `agent.json`.
Kind-neutral code lives in `agents/shared/` (the phone tools,
`agents/shared/phone-tools/`, packaged per its `part.json`) and is packaged
inside each kind's config (`agents/opencode/config/phone-tools/`), so a
kind's plugins import it by a relative path; the full-only `control/` part
is dropped outside full. `agents.gradle`'s `syncAgentConfig<Variant>` task
reads the manifests and packages each kind whose `channels` include the
flavor into generated Android assets at `agents/<id>/` (`agent.json` and
`config/`; a future iOS implementation can copy the same directory).
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

## Build channels

`full`, `lite` and `play` (what each ships, permissions, tool gating):
`bridge.md` → Build channels. `./manage build lite|full` builds a signed
APK and audits it; `./manage release <version>` builds both and drafts the
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
its "Restricted setting" notice for the app. What the app can know, from
the AOSP 13–16 sources (details: `research/restricted-settings.md`):

- The lock state is unreadable by design (the `access_restricted_settings`
  app op is `restrictRead`; reading it needs signature permissions).
- Whether the lock was applied follows the install source: an install
  declared as a local or downloaded file (Files, a browser, the system
  installer screen) locks; a store, `adb install` or other session does
  not. Android 14+ locks only a first install, 13 every install from a
  file; the lock survives updates. In our flow it comes from lite's install
  from Files and carries over to full. `getInstallSourceInfo()` shows only
  the latest install, so it feeds only the bridge's best guess.
- Android 14+ lets us show that notice in place
  (`android.settings.SHOW_RESTRICTED_SETTING_DIALOG`), which adds the App
  info item. It locks an app that was not locked, so the worst case is one
  extra confirmation (checked on the Moto G96, Android 16).

Since the lock cannot be read, `RESTRICTED_FLOW` (`true`, in
`app/src/ui/accessibility/guide.ts`) runs a three-step guide in the
accessibility prompt and in Settings, every step visible (`StepList.tsx`):

1. Show the "Restricted setting" notice: in place on Android 14+
   (`showRestrictedSettingNote()`), else by opening Accessibility so the
   user taps PhoneCanDo.
2. App info (`openAppInfoSettings()`) → "Allow restricted settings".
3. Accessibility (`openAccessibilitySettings()`, scrolled to PhoneCanDo on
   AOSP-based builds) for the switch.

Coming back to the app moves to the next step, and each step has one-tap
corrections. The guide ends when the service is enabled or binds, is
skipped once the service has run on this install
(`hasAccessibilityConnectedBefore()`; on Android 13 a later update from a
file voids that), and runs only on Android 13+. With `RESTRICTED_FLOW`
false the plain flow shows, with a link that starts the guide at step 2.

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
