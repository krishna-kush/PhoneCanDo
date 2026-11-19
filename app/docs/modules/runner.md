# phonecando-runner (engine host)

`phonecando-runner` (`com.phonecando.runner`) is the Expo module that hosts
the agents' engines: the agent records, the engine supervisor and its
foreground service, the memory guard and the user's run limits, the
loopback bridge (`bridge.md`), the messages between agents, agent
installs, the local model servers and the config it seeds into each
engine's HOME.

## Native API

- `api/AgentFunctions.kt`: `listAgents`, `createAgent({kind, name,
  imageId})`, `renameAgent`, `deleteAgent` (stops the agent's engine first;
  the image stays, and JS deletes it through `phonecando-linux` once no
  agent uses it). `createAgent` on an image that already has an agent of
  the same kind gives the new one its own state folder (`ownState`) and
  that agent's `installedVersion`, or refuses `kind_cannot_share` when the
  kind has no `state` block (see Shared machines). The record JS sees is
  `src/engine/agents/records.ts`.
- `api/AgentModelFunctions.kt` (see Local model servers):
  `setAgentModel(agentId, modelId | null)` stops a starting or running
  engine and resolves `{wasRunning, agent}`; JS starts it again. It rejects
  `model_unavailable` for a kind that takes no local model or a model not
  on the phone. `stopModelAgents(modelId)` stops every agent on the model
  whose engine is starting or ready (one grace) and resolves their ids for
  JS to start again: how a new context takes effect (`models.md` →
  Context). `stopModel(modelId)` stops the model: its agents first (as
  above, plus any holding its server), then its server, also while it
  loads; it resolves the agents it stopped, which stay stopped.
  `promptReading()` and the `phonecandoPromptReading` event (`{reading}`)
  give the prompt a model server reads now.
- `api/EngineFunctions.kt`: `startEngine(agentId, mode?)`, `stopEngine`,
  `stopAllEngines(keepRuns)` (keepRuns: the runs going are kept and offered
  back, see Cut-off runs), `isAnyEngineAlive`, `touchEngine`, `engineStatus`,
  `engineStatuses`, `isEngineIdle` (the kind's idle rule, no job left
  running and not kept running; see Jobs and the idle stop) and
  `engineHealth` (`ok|starting|http-N|error:…`, one probe; a TUI engine
  answers by its state). Every change is the `phonecandoEngineState` event
  (`EngineStatus`, with `mode` and `busy`: see ACP mode). `startEngine`
  resolves `{port}` (null for a TUI engine or ACP mode) once the process
  runs; an engine already starting or ready in that `mode` (`terminal`, the
  default, or `acp`) resolves at once. It rejects with an `EngineStartError`
  code (`records.ts`), at once for a mode switch it may not make
  (`acp_busy`, `terminal_in_use`).
- `api/InstallFunctions.kt` (see Installing an agent), all synchronous:
  `guestUnset`, `installPlan`, `updatePlan`, `versionCheck` and
  `recordInstall`. A refusal's code, also the start of its message, is
  `no_recipe` or `verify_failed`.
- `api/EngineTerminalFunctions.kt`: a TUI engine's terminal (see TUI
  engines), all synchronous: `engineTerminalAttach(agentId)` →
  `{viewerId, rows, cols}` (the PTY's size now),
  `engineTerminalRead(viewerId, max)` → base64, or null when nothing is
  pending (max capped at 64 KiB), `engineTerminalWrite`,
  `engineTerminalResize`, `engineTerminalFocus(viewerId, shown)` (see TUI
  engines → Answers) and `engineTerminalDetach`. A refusal's code, also
  the start of its message, is `not_running` (no starting or ready TUI
  engine), `ended` or `detached`.
- `api/KindFunctions.kt`: `listKinds` (a JSON array of `KindView`,
  `agents/kit/ts/contract/view.ts`; never a template or a secret),
  `pairWebUi(agentId)` (the web UI's one-time sign-in URL, see opencode)
  and `clientRecipe(agentId, projectDir, sessionId?)` (`{cmd, env, cwd}`,
  the kind's TUI attached to the agent's engine).
- `api/UserKindFunctions.kt`: the user's own kinds (see Agents), all
  synchronous: `listUserKinds` → `[{id, label, problem}]` (every file;
  `problem` says why one does not load), `readUserKind(id)`,
  `validateUserKind(json)` → `[{path, detail}]` (JSON pointers; empty when
  it would load), `saveUserKind(json, replace)` → `{id, problems}`
  (nothing written when there are problems, or the id exists and `replace`
  is false) and `deleteUserKind(id)` → `{deleted, usedBy}` (refused, with
  their names, while agents are of the kind).
- `api/ClipboardFunctions.kt`: `copyText(text)` and `clipboardText()`
  (plain text; how a custom agent's JSON is shared and imported).
- `api/NotifyFunctions.kt`: `consumeLaunchTarget` and `dismissAgentAlert`
  (see Notifications).
- `api/RunLimitFunctions.kt` (see Run limits), synchronous: `runLimits()`
  and `setRunLimits({maxAgents, maxModels})` → the caps as kept.
- `api/MemoryFunctions.kt` (see Memory guard): `memoryStatus()`, the
  guard's reading now with each running agent's and model server's bytes;
  changes come as the `phonecandoMemory` event (same shape).
- `api/KeepRunningFunctions.kt` (see Jobs and the idle stop), synchronous:
  `keepRunning(agentId)` and `setKeepRunning(agentId, on)` → as kept.
- `api/MessageFunctions.kt` (see Messages), synchronous:
  `messageLog(limit)` (`NativeMessage[]`, newest first), `unreadCounts()`
  (`{agentId: n}`), `screenQueue()` (`{holder, reserved, waiting}`) and
  `setAgentWakeable(agentId, wakeable)` → the agent as kept; changes come
  as the `phonecandoMessages` event (`{unread}`).
- `api/PickFunctions.kt` (`pick/PickDialogs`): `pickDate(year, month,
  day, minMs, maxMs)` → `{year, month, day}` and `pickTime(hour, minute)`
  → `{hour, minute}` (the phone's 12- or 24-hour clock), Android's own
  dialogs over the current activity; null when cancelled or no screen
  shows (the Schedules editor's day and time).
- `api/ScheduleFunctions.kt` (see Schedules), synchronous:
  `listSchedules()` (`NativeSchedule[]`, the wire JSON),
  `addSchedule({agentId, text, timing, chat?})` and `updateSchedule(id,
  {text?, timing?, chat?, on?})` → `{ok: true, schedule}` or `{ok: false,
  reason, code}` (reason `limit`, `unsupported`, `not_found` or
  `agent_gone`, else a sentence), `removeSchedule(id)`,
  `runScheduleNow(id)` → `{ok}` or `{ok: false, reason}`,
  `scheduleRuns(limit)` (newest first), `scheduleAlarms()` (`{exact}`),
  `openAlarmSettings()`, `canScheduleItself(agentId)`,
  `setCanScheduleItself(agentId, on)` and `kindRunsSchedules(kindId)`;
  changes come as the `phonecandoSchedules` event (`{}`).
- `api/PresenceFunctions.kt` (see Presence): `presenceSnapshot()` (the
  frame as `{driver, handOver, statuses}`, `presence/PresenceJs`),
  `presenceAct(act)` (a `UserAct` name; false when it does not apply now)
  and `setMascotFigures(agentId, json)`; changes come as the
  `phonecandoPresence` event (the same map).
- `PhoneCanDoRunnerModule.kt`: `getPrefix`, `getBuildChannel`, the
  phone-control switch, the `phonecandoLaunchTarget` event, the bridge
  prompts (`pendingPrompts`, `resolveUnlock`, `resolveAccessibility`, event
  `phonecandoBridgePrompt`; see `bridge.md`), the `phonecandoRunFinished`
  event (`{agentId, sessionId}`: a top-level run that finished well, from
  `AgentAlerts`, in front or not; the app's "Having fun?" card counts
  them), the accessibility guide calls,
  `canRequestPackageInstalls`, `markSelfUpdatePending`,
  `requestNotificationPermission` and telemetry. `pendingPrompts` also
  lists the agents' links to open, which `resolveOpenUrl` ends (see
  Notifications).
- `agents/`: the kinds. `KindCatalog` (`KindCatalogs`) reads every packaged
  `agents/<id>/agent.json` from the APK assets on first use, decodes it
  (`agents/kit/kotlin/manifest`) into a `ManifestKind`
  (`agents/kit/kotlin/render`) bound to its code hooks from `BuiltinHooks`
  (`agents/builtin/kotlin`), then adds the user's kinds (see Agents).
  `RuntimeCatalog` reads the packaged runtime plugins
  (`agents/runtimes/<id>/`, full and lite only) first, so each kind is
  bound to the runtimes it needs. A kind that cannot load (a bad manifest,
  a broken user rule, a hook or runtime this build lacks) is left out and
  logged. The runner never names a kind: the supervisor, health checks,
  event streams and redaction go through `AgentKind`
  (`agents/kit/kotlin/api`). `AgentStore` keeps the agents and is the
  `AgentDirectory` redaction reads. The bridge reads
  `engine/LiveAgents.kt`, the agents whose engine is starting or ready and
  was given the bridge: a stopped agent's token gets 401, and the screen it
  held is free at once.
- `engine/`: the engine supervisor and what it uses (below);
  `engine/image/` reads the image files an engine needs, `engine/proc/`
  finds, reads and ends an agent's processes, `engine/spawn/` starts an
  engine by its style, `engine/ready/` says when it is ready, `engine/tui/`
  is a TUI engine's terminal and viewers, `engine/work/` tells the jobs an
  agent left running from the agent and stops idle agents (see Jobs and
  the idle stop), `engine/starts/` starts an engine with nobody in the
  app (`EngineStarts`), holds an agent back after a failed start or a
  silent ACP turn (`StartHolds`) and says whether the phone has room for one more
  (`StartRoom`; see Messages → Starting a stopped agent).
- `power/`: the wake lock that keeps the CPU awake while work runs (see
  Jobs and the idle stop).
- `models/`: the local model servers (see Local model servers).
- `messages/`: the messages between agents (see Messages).
- `jobs/`: the jobs anchor, which keeps the service up while model and
  Linux jobs run (see Foreground service and lifetime).
- `memory/`: the memory guard (see Memory guard); `limits/`: the user's
  run limits (see Run limits).
- `notify/` and `prompts/`: the agents' notifications, alerts and links to
  open, and where a tap opens the app (see Notifications).
- `PhoneCanDoServeService.kt`: the foreground service (`specialUse` type).
- `PackageReplacedReceiver.kt`: brings the app back after a self-update
  (see Self-update install).
- `AndroidManifest.xml`: service, receiver and `OpenTargetActivity`
  declarations plus `FOREGROUND_SERVICE*` and `WAKE_LOCK` permissions (merged at build);
  the service's `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` is the reason Play
  reviews.

## Agents

An agent is one instance of a kind with its own name, image, port, engine
password and bridge token; it is created and deleted together with its
image. `AgentStore` keeps them in `files/state/agents.json`: every change
writes a temp file, syncs it and renames it over the old one, so a crash
mid-write leaves the previous list whole. Each agent gets a random id plus
a 192-bit password and bridge token from `SecureRandom`. The token never
reaches JS, and the password only inside the TUI client's recipe
(`clientRecipe`), which JS hands to the PTY without storing it. The image
id names `files/images/<imageId>/`, so it is short and has no separators.
`ranBefore` turns true the first time the agent's engine is ready; from
then on a launch adds the kind's resume args (`engine.resume`). A start
for a scheduled task (Schedules) leaves its first prompt in
`engine/StartPrompts` (dropped after 2 minutes unused); `plan()` takes it,
and the launch adds the kind's `engine.prompt` args with the task as one
argv item, after the resume args. A task for a new chat starts without
the resume args. `acpChat` is the chat the agent's ACP mode last worked in
and the agent answered in (see ACP mode): the next terminal launch clears
it, and for a kind with `engine.acp.chat` opens it instead of the resume
args.

Only an engine whose kind names its phone tools (`phoneTools` `plugin`,
`mcp:config` or `mcp:argv`; `engine/BridgeAccess.kt`) gets the bridge: its
URL and the agent's token in its env, and answers from the bridge while it
runs. Any other engine, and everything it starts, never sees the token. Its
machine is still no sandbox (proot): a process in it runs as the app.

The user's own kinds (what one may hold: `agents/AGENTS.md` → User-added
kinds) are files in `files/state/agent-kinds/user/<id>.json`. In the
runner's `agents/user/`, `UserKinds` lists, reads, saves and deletes them,
and `UserKindRules` checks one the same way at a save as at a catalog load.
A save is atomic like the agents file. A save or delete reloads the catalog
in place (`KindCatalogs.reload`): later lookups see the new kinds, while a
running engine keeps the kind it started with, so an edit applies from the
agent's next start. A delete is refused while an agent is of that kind.

## opencode (the native kind)

Its payload (`liboc-engine.so`, `liboc-opentui.so`) ships as `jniLibs`,
extracted at install (`expo.useLegacyPackaging=true`, set by
`app/plugins/withExtractNativeLibs.js`), and runs directly: INTERP is the OS linker,
bionic system libs only. Build and stage: `agents/native/opencode/docs/`.

Its `agent.json` is the recipe: `liboc-engine.so serve --port <port>
--hostname 127.0.0.1` in the work folder, with `OPENCODE_SERVER_PASSWORD`,
`OPENTUI_LIB_PATH`, the file watcher, auto-update and LSP downloads off,
and no model pin. The server's cwd is only where a request that names no
folder lands, which the web UI opens as its first project. Config still
comes from `~/.config/opencode/` (and project files found walking up to
`/`), and chats live in its database under `~/.local/share/opencode/`,
keyed by project, so nothing is written into the folder. The TUI client
sends its own folder.

v2 serve is auth-first (`engine.auth.basic`): the health probe, event
stream, chat-title read, pairing and TUI send HTTP Basic with the agent's
password (user `opencode`). The web UI signs in natively (`pairWebUi`):
`POST /api/pair` mints a single-use code, and `/auth/connect/<code>`
redeems it in the WebView; a 401 retries once with the password read
again. Its one code hook is the SSE event parser (`opencode.events`).

## Engines

`EngineSupervisor` (one per process, `Engines.get`) runs one engine per
agent, several at once, of either engine style (`agents/AGENTS.md` →
Engine styles): a **server** (opencode) serves HTTP on its own loopback
port, a **TUI** is the kind's own TUI on a PTY of ours (see TUI engines).
The style matters only behind three seams: `EngineProcess`
(`engine/proc/`: `ServerProcess` or `TuiProcess`), `ReadyProbe`
(`engine/ready/`: `HttpReady`, or a TUI's `OutputReady`/`AliveReady`) and
`EventSource` (the SSE stream, or a TUI's output signals); the spawners
are in `engine/spawn/`.

- **Start.** `startEngine` registers a request and sends `ACTION_START` to
  the service, which runs starts one at a time on its own thread. A start
  is refused with `agent_not_installed` while the agent's install is owed
  (see Installing an agent), then takes a seat (`EnginePolicy`: no cap by
  default, the memory guard looks after RAM; with the user's cap on
  agents, see Run limits, a start past it stops the least recently used
  ready engine that has been idle for a minute, and is refused with
  `too_many_running` when none has), ends processes an
  earlier life of this agent left behind, reads the image
  (`run/engine.env`; missing means `image_not_ready`), makes the work
  folder (see Agent images), seeds the config, opens the bridge, takes a
  port (a server engine only) and spawns.
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
  `PHONECANDO_IMAGE` and `MAKEFLAGS`), then the kind's launch env, then
  ours on top: `PHONECANDO_BRIDGE_URL` and this agent's
  `PHONECANDO_BRIDGE_TOKEN` (only while the bridge is up), a TUI engine's
  `PHONECANDO_EVENTS` (see TUI engines), for a kind with an `inbox` block
  `PHONECANDO_INBOX` (see Messages), `PHONECANDO_CHANNEL` and, last,
  `PHONECANDO_AGENT=<agentId>`. A server engine runs from the
  native-library dir in its `launch.cwd` (HOME when it names none); its
  stdout and stderr go to `<image>/logs/engine-<agentId>.log`.
- **Stop.** SIGTERM to the engine (a TUI's terminal is hung up instead)
  and to every process of our uid whose `/proc/<pid>/environ` carries its
  `PHONECANDO_AGENT` tag, a wait of up to 3 s (tagged processes that appear
  meanwhile get SIGTERM too), then SIGKILL to the rest (`engine/proc/`).
  Everything an engine starts inherits the tag, so this also ends shells,
  language servers and proot it left behind, and engines from an earlier
  app process. Stopping every agent takes the same one wait. A stop by the
  memory guard ends as `stopped` with the error `low_memory: stopped to
  free memory`, the only stopped status with an error (the next start
  clears it).
- **Death.** An exit nobody asked for marks the engine `died` and drops its
  process, so the next start launches it again; a TUI that exits 0 just
  stopped (`stopped`, no error). Nothing restarts it by itself.

### TUI engines

A kind with `engine.style: "tui"` runs its own TUI as its engine, on a PTY
of the terminal module's process-wide `PtyHost` (`terminal.md`), so it
keeps running when you leave the tab or the app (the foreground service
holds it like any engine) and survives a JS reload. Home shows it.

- **Launch** (`TuiSpawner`): a cooked tty, as a terminal emulator gives (a
  raw start drops every carriage return), 24×80 until a viewer resizes it,
  in `launch.cwd` (default HOME), with the server engine's layered
  environment plus `TERM`, `COLORTERM`, `LANG=C.UTF-8` and, once the app
  has given its terminal theme, `COLORFGBG` (`15;0` dark, `0;15` light,
  kept until the engine restarts) under the kind's env. A native TUI kind runs from the native-library dir. An image kind
  runs in its image through `<image>/shims/sh` (`agents/AGENTS.md` → Image
  kinds), on a PTY handed on to the guest (`handOver`, as for the Linux
  shell); an image without Linux has no `shims/sh` (`image_not_ready`). It
  sees only guest paths (`{{home}}` is `/root`), so the host's spelling of
  HOME never reaches its trusted folders or per-folder chats.
- **Output** (`engine/tui/EngineTerminal.kt`) always drains, on the PTY's
  reader thread, whether or not anyone watches: into a ScreenRing (kit-term,
  about 1 MiB, trimmed at the last full clear, reset or alternate-screen
  entry, cut only between whole sequences and characters), through the
  SignalScanner (kit-term) to the engine's events, and to the viewer.
- **Readiness**: the manifest's `output` or `alive` rule (`agents/AGENTS.md`
  → Engine styles). An exit before it is a failed start.
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
  output. A viewer that stops reading (Home paused under a page) is
  bounded: past 2 MiB queued, its queue becomes a fresh replay. After the
  engine stops or dies, a viewer reads what is left, then `ended`. Writes
  and resizes from a viewer that is not the current one do nothing; a
  resize to the same size still makes the program repaint.
- **Answers** (kit-term `TermReplies`): from the first byte, watched or
  not, the runner answers as a terminal would. The Program Status
  Protocol's support query (`OSC 7501 ; ?`) gets `OSC 7501 ; ? ST`, ending
  as the query did; some TUIs report their state only after that answer.
  Once the TUI turns on focus reports (DECSET 1004) it hears its focus at
  once and on each change: `CSI I` while a viewer shows it
  (`engineTerminalFocus`: the view on screen and the app in front, told
  after the replay), `CSI O` with no viewer, a hidden one or after a
  detach. So a TUI that notifies only while unfocused does so whenever
  nobody looks. xterm.js never reports focus itself (`disableStdin`).
  From the app's terminal theme (`engineTerminalTheme`, which JS sets at
  start and on every change of scheme; `TerminalThemes` holds it for every
  engine) it answers colour queries (OSC 4 / 10 / 11 / 12) and the theme
  query (`CSI ? 996 n`), and while the TUI has DEC mode 2031 on, a change
  sends the theme report (`CSI ? 997 ; 1 n` dark, `; 2 n` light). Device
  attributes (`CSI c`) and the status (`CSI 5 n`) are always answered,
  the fences programs put after a colour query. Before JS gave a theme,
  colour and theme queries go unanswered (`terminal.md` → Theme).
  Answers due before the PTY is bound go out once it is.
- **Events** (`engine/tui/TuiEvents.kt`): the kind's `events[].pty.rules`
  turn bells, OSC 9 / 9;4 / 777 notices and OSC 7501 status reports into
  engine events for the TUI's one chat (session `tui`), which go to the
  agent's alerts and the chat board like a server's. The window title
  (OSC 0/2), through `surfaces.chatTitle`, is that chat's title, with or
  without a viewer; a title the pattern rejects (Claude Code's "✳ Claude
  Code" in a fresh chat) clears it, so a new chat never shows the last
  one's title in the notification.
- **Events file** (`engine/events/`): every start of a TUI engine seeds
  the kit's scripts (`agents/kit/scripts/`: `phonecando-event`,
  `phonecando-open`, `phonecando-inbox`) into
  `<home>/.phonecando/bin/` (mode 755, replaced whole) and empties the
  agent's own `<home>/.phonecando/events-<agentId>`, whose path the engine
  gets as `PHONECANDO_EVENTS` (`/root/…` for an image kind); without it the
  scripts write nothing. An image kind also
  gets `BROWSER` = that `phonecando-open` unless its env sets one.
  `phonecando-event <name> [message]` appends
  `<name>\t<session>\t<message>`, `phonecando-open <url>` appends
  `@open\t<url>`, `phonecando-inbox` the receipt `@inbox\t<ids>` (see
  Messages); a line over 4 KiB is dropped whole. While the engine is
  ready, `EventFileTail` reads new whole lines every 500 ms (one thread for
  all engines; a file that got shorter is read from its start).
  `EventSink` maps a name through `events[].hook.map` to an engine event;
  an unmapped name does nothing. An `@open` line becomes an `open_url`
  prompt (see Notifications); an `@inbox` line marks those messages read.
- **Idle**: `idle.from: ["output"]` makes PTY output the activity: no
  output for `quietSec` is idle, and output marks the engine used.
- **Resume**: a launch with `engine.resume.args` that exits other than 0
  before it is ready, or once ready but before it raised any event
  (first-run screens made it ready), may have had nothing to resume
  (`claude --continue` in a folder without a chat), so it is launched once
  more without them, as the same start (`ResumeFallback`: one start, no
  death). A scheduled task's first prompt stays with that second launch.
- **Stale runs**: hooks may never say a run ended (Claude Code's Esc fires
  none), so for a kind with `events[].hook` a run left `working` ends as
  stopped and leaves the chat board once it has shown nothing for 30 s
  after you typed into it (only you can type an Esc), or for 30 min with
  no typing (a hook that never fired). A TUI nobody looks at is unfocused
  and may show nothing while a slow model works, so without your typing
  the 30 s rule never takes it: its chat stays working, and with it the wake lock, the idle
  stop's hold and everything else that reads the chat board.

JS starts engines through `src/engine/ensureEngine.ts` (one start in flight
per agent; a ready engine is only marked used) and waits for a fresh start
with `waitForEngine` (`src/engine/connection.ts`). It never talks to an
engine itself: the web UI's sign-in URL and the TUI's recipe come from this
module (`pairWebUi`, `clientRecipe`).

### ACP mode

A TUI kind with `engine.acp` (`agents/AGENTS.md` → ACP mode) can also run
as the same agent speaking the Agent Client Protocol on stdin and stdout,
with no screen. An agent runs in one mode at a time, in its one engine
slot (`EngineMode`): `terminal` (its TUI, what Home shows) or `acp`. We
start ACP mode only for work that comes while nobody watches: a scheduled
task, or a message that may wake it (see Messages, Schedules). Opening Home
asks for the terminal again, on the same chat.

- **Start.** `start(agentId, requestedAt, mode)`, from `startEngine`'s
  `mode` or the start intent's `EXTRA_MODE` (`acp`; absent is terminal). A
  kind without `engine.acp` is refused in ACP mode. The plan prepares HOME
  as for its TUI (kit scripts, events file, inbox folder: its hooks still
  run) and takes the start's task (`StartPrompts`) whatever the kind's
  `engine.prompt`, as its driver sends it. The launch is the kind's
  `acpLaunch` (launch env, state env, model env, then `engine.acp.env`; an
  image kind through its image's sh) as a plain process
  (`engine/acp/AcpSpawner`): its stdin and stdout are ACP's, its stderr
  goes to `<image>/logs/engine-<agentId>.log`. Its env has no terminal
  values, and with `tools` `session` no bridge either: the bridge goes in
  each chat instead.
- **Driver** (`engine/acp/AcpAgent`, over `AcpConnection`: one JSON-RPC
  message per line, a reader thread, one write at a time; it never logs a
  message, as chats carry the bridge token). It sends `initialize` (we
  offer no file system, no terminal, no sign-in through one), then opens
  the chat (`AcpChats`): a task that wants a chat of its own gets
  `session/new`; anything else the kept `acpChat` (where ACP mode last
  worked with no terminal launch since, or what a Check now gave back),
  else the newest chat (`session/list` for the work folder, newest
  `updatedAt`), reopened with
  `session/load` or `session/resume`, else a new one. Each carries the
  folder as the agent sees it, the kind's rendered `meta` as `_meta` and,
  with `tools` `session` and an agent that takes MCP over HTTP, the bridge
  as an HTTP MCP server (`<bridge>/mcp`, the agent's token as a bearer
  header); an agent without HTTP MCP gets no phone tools in ACP mode, so a
  kind like that sets `tools` `config`. The chat's id is kept as the
  agent's `acpChat`, and the kind's `options` are set where the agent
  offers them (`session/set_config_option`), with what its `optionsHook`
  reads from the agent's HOME at that open on top (`acpHomeOptions`; its
  value need not be in the option's list). A kept chat the agent
  refuses to reopen is forgotten (an agent gone, a timeout or a sign-in
  first says nothing of the chat, so those keep it); the log says why,
  with what the error's `data` says (`AcpError.detail`: the ACP SDKs put
  why an "Internal error" happened there). A new chat is kept at once, so
  a run cut off mid-turn goes on in it, but for good only once a turn in
  it was answered (a stop reason other than `cancelled`, no error;
  `AcpKeptChat`): its first turn ending unanswered gives back the chat
  kept before, or none. An agent may keep no chat it never answered in
  (Gemini CLI takes back a failed turn and deletes a chat left empty at
  its next start), and a terminal launch on it would fail (Gemini CLI
  exits 42). A start with a chat of its
  own also notes the chat it would have gone back to (`chatBefore`: the
  kept `acpChat`, else the newest `session/list` names), which Check now
  gives back (see Checks). Then it is ready
  (`AcpReady`: within the kind's `readiness.output.timeoutSec`, else
  120 s); a chat it cannot open (a sign-in it wants) fails the start with
  why. Once ready it sends the start's task as its first prompt.
- **Turns.** One prompt at a time. While a turn runs, its updates fold into
  items (`AcpTurn`: text and thoughts merged per message, tool steps, the
  plan; at most 200 items and 64 Ki characters a turn; a reopened chat's
  replay shows nothing), its permission questions wait for an answer (from
  the app or a notice, see Notifications) and `cancel` answers them
  cancelled. Any other request of the agent's (`fs/*`, `terminal/*`) is
  refused. `AcpEngines.of(agentId)` is the ready driver for the rest of
  the runner, and `AcpEngines.listener` hears every item, question, busy
  change and turn end.
- **Silent turns** (`AcpTurnWatch`, a look every 10 s). A turn that shows
  nothing for `SILENT_MS` (3 minutes) went silent: it waits on something
  only its own app shows (a sign-in, a folder to trust) or on its provider
  (a used-up limit it retries for minutes), and would hang a message's or a
  task's start unseen. Signs: anything the agent sends for the turn (text,
  thinking, a tool call or its update, a question), and while they last an
  open question, a tool call not completed or failed (a long build sends
  nothing), and the local model it runs on at work for it (reading the
  prompt, minutes on a small phone before the agent can send anything, or
  writing: `PromptWatch.working`, which looks with the screen off while an
  ACP turn runs). A silent turn is cancelled (`session/cancel`) and ends
  failed with why; the driver takes no prompt any more, and the supervisor
  stops the engine (`failed`, with why), holds our own starts back as
  after a failed start (`StartHolds`, 10 minutes) and posts a notice in
  the agent's slot whose tap opens its Home, its own app
  (`notify/SilentTurnNotice`). While a Check now has the agent its own
  stuck rule decides instead.
- **Busy.** From its start until the turn of the work it came for ends:
  starting, the start's task, or (with none) up to a minute after ready
  for a waking message's prompt (`waitingForWork`: a prompt is still
  taken then). `EngineStatus.busy` says so (always false in terminal
  mode), with a status event on each change.
- **Events.** Its turn's course is the engine events of a TUI's one chat
  (`AcpEvents`, session `tui`): a prompt sent is working, a question
  waiting, its answer working, the end by its stop reason (`end_turn`
  finished, `cancelled` stopped, `refusal`, `max_tokens`,
  `max_turn_requests` or an error failed). So alerts, the chat board and a
  run's end work as in terminal mode. The events file is still read, but
  only for links (`@open`) and receipts (`@inbox`): ACP says how the run
  goes, not the hooks.
- **Idle.** Never with a turn running or a question open; then the kind's
  `quietSec`, with what the agent last sent counting as its output. Every
  message from it marks it used.
- **Exit.** Any exit we did not ask for is `died`, with its exit code and
  the last line of its stderr (redacted); it never relaunches without its
  resume args. A stop closes its stdin first, then stops it as any engine.
  Its turn ends then, with an error.
- **Switch** (`ModeSwitch`, in `start` and synchronously in `startEngine`).
  The terminal while ACP mode is busy or asks a question is refused
  `acp_busy` (Home keeps showing the turn); ACP mode while a viewer shows
  the TUI (`EngineTerminal.hasViewer`: attached and on screen with the app
  in front), a run of it is working or waiting, or it has jobs running or
  is kept running is refused `terminal_in_use`. Messages and Schedules
  also count a terminal start the app asked for (`startEngine`, Home
  opening it) as a viewer until a view attaches, at most 2 minutes, with
  the app in front (`engine/tui/HomeStarts`), so they never ask for the
  switch under a Home that is still opening. Otherwise the engine stops
  as a user stop would, and the start goes on in the other mode. A
  terminal launch then opens the chat ACP mode left (`acpChat`, for a kind
  with `engine.acp.chat`; a task that wants its own chat wins), and falls
  back without it as without resume args (`ResumeFallback`).

## Local model servers

An agent of a kind with a `models` block (`agents/AGENTS.md` → Engine
styles) can run on a local model instead of its own provider. The model
files are `phonecando-models`' (`models.md`); the runner serves them
(`models/`):

- **One join.** `LocalModelBinding.kt` is the one place agents meet local
  models; neither `agents/` nor `lme/` knows the other (its header traces
  a record's `model` to the kind's env and args). A start refuses
  `model_unavailable` at once for a kind that takes no model or a model
  that is gone, and `too_many_models` for a model that is not loaded while
  the user's cap on loaded models is reached (see Run limits); once the
  seat is taken it gets the model's server up.
- **The servers.** `ModelServer.kt` runs one llama-server per model, as
  many models at once as the user's cap allows (none by default; the
  memory guard looks after RAM), outside the agents' cap, each started on
  demand from lme-host's launch plan: `libllama-server.so` from the
  native-library dir, loopback on a port from `PortAllocator`, a fresh
  random key per start in `LLAMA_API_KEY` (never the argv), one slot
  (`--parallel 1 --slot-prompt-similarity 0`), the context lme-host plans
  (`models.md` → Context and memory; the kind's `{{contextWindow}}` is what
  the server got), an 8-bit KV cache when the model needs it to reach 32k
  (or, with chats in RAM, to keep room for one), `--ctx-checkpoints 4` for
  a model with recurrent or sliding-window layers, and the chats that take
  turns on the slot kept on storage (`--slot-save-path`, see Chats on
  storage) or, short of storage, in a RAM prompt cache (`--cache-ram` with
  room for two whole prompt states from what that leaves: every request
  saves the slot's prompt there and loads the best one saved), each
  changeable on the model's Memory setting; with
  its Detailed log on, the server's trace and slot-debug variables
  (`lme/docs/README.md` → RAM gate and context). The plan goes to logcat (`PhoneCanDoModels`: the
  context, the prompt cache, what the server holds in all once that
  fills, measured or estimated, and the chats kept on storage); a chosen
  context past the RAM budget is logged, an automatic one past it is
  refused. It tells `ModelsHost` what each
  serves, so each model's card shows its server's own context. The start
  waits for `/health` (up to 5 min), so the agent stays `starting` while
  its model loads, and the service's start thread waits with it. Each
  server's output goes to `files/logs/model-server-<model id>.log`,
  written afresh on each start, and the model's Server log page reads its
  end (`modelServerLog`, `models/ModelServerLog.kt`); its
  process carries `PHONECANDO_AGENT=model-server` and
  `PHONECANDO_MODEL=<model id>`, so a stop-all finds every one and the
  memory guard tells them apart. The first launch in an app process ends
  what an earlier process left (later, a tagged server is a sibling of
  ours, so only then).
- **Sharing and stopping.** Agents bound to the same model share its
  server (`ModelSlotPolicy.kt`: join it when it answers; refuse with
  `model_unavailable` while it still loads for another agent, which is
  rare as starts run one at a time). Each engine's hold on its model ends
  with it (a stop, a failed start, a death), and the last one stops that
  server (SIGTERM, SIGKILL after 3 s). A mode switch (ACP mode) keeps it:
  the engine in the new mode joins the server still up, with its saved
  chats, instead of loading the model and reading the agent's prompt
  again; if that start does not happen, or runs on no model of its own (a
  Check now's), the kept hold ends then. An agent holds one model:
  acquiring another ends its hold on the first. `stopModel` stops its agents first,
  then the server, also while it loads. A server that exits by itself
  takes its agents down (`died`, `model_unavailable`): their engines had
  its URL and key.
- **Measured memory** (`models/measure/`). Before a start the plan counts
  what the server will really hold: its weights read in place, the
  weights llama.cpp copies into the CPU's own layouts (CPU_REPACK,
  CPU_KLEIDIAI: anonymous memory, which depend on the phone's CPU) and
  its compute buffer. `ModelMeasurer` runs the server's own dry run with
  the start's flags plus `--port 0 --fit on --log-jsonl` (`FitProbe`:
  about half a second, no weights loaded) and reads its
  `fit_memory_breakdown` line from stdout, then kills it; the real
  server's log never sees these JSON lines, so the Server log page and
  the prompt watch read it as before. The measurement is kept beside the
  model's files (`<id>/.memory.json`, lme's `ModelStore`) with the phone
  and server build it was taken on (`MeasurePolicy`); a start whose plan
  it does not count (another context or note size) measures again, then
  plans with it: past the budget that means a smaller context, or a
  refusal, not the memory guard. The runner also measures in the
  background every model this phone has not (at its start, and after a
  download or import, `ServingSource.measureSoon`), so the Memory page
  and the model's RAM verdict count the truth before its first start;
  until then lme's estimate (`lme/docs/README.md` → RAM gate and
  context). The dry run carries the same tags as a server, so a stop-all
  or the next app process reaps one left behind.
- **Chats on storage** (`models/chats/`). With room on storage (lme's
  `StoredChats`: one more chat above 1 GiB free) the plan gives the
  server `--slot-save-path files/models/<id>/.chats/` and no prompt
  cache, and the RAM goes back to the context. Agents then get the URL of
  a go-between on a loopback port of ours (`ChatRelay`), with the same
  key: every request and its streamed answer pass through unchanged, for
  every route (`RelayExchange`: `Connection: close` upstream, a chunked
  body sent whole, the client leaving closes the server's side, which
  stops its work). A request that runs the model (`/v1/messages`,
  `/v1/chat/completions`, `/v1/responses`, the completions) and carries
  the server's key takes the one slot in turn, held until its answer
  ends (`ChatSwitch`, fair). Its chat's key (`ChatKeys`: a hash of the
  model, the system prompt or instructions, the tools and the first user
  message, per wire API, without `cache_control`) picks what happens:
  another chat than the slot's saves the slot's first (`POST
  /slots/0?action=save` to `<key>.tmp`, renamed to `<key>.bin`, made
  0600), then loads the request's own if saved (`action=restore`); a
  failed save or load just forwards (a file the server will not load is
  deleted). `ChatFiles` keeps at most 4 per model, the least recently
  used going first, deletes the oldest before a save until 1 GiB stays
  free (else it skips the save), and empties the dir when the model
  file, context, note size, checkpoints or server build change (a
  `shape` file, `ChatShape`); the dir goes with the model. A planned stop
  (its last agent leaves, `stopModel`) saves the slot's chat first when
  the slot is free within 2 s, so a chat comes back after a restart too.
  Three failed saves in a row stop saving for that run and put the
  model's chats back in RAM from its next start. Without a go-between
  (no port) agents talk to the server itself. The prompt watch and the
  readiness probe always talk to the server itself.
- **Refusals** say why after `model_unavailable:`, in words the agent's
  page shows as they are (`ModelReasons.kt`; never a path or a key).
- **Secrets.** Every key this process gave a model server
  (`ModelServerKeys`) is redacted like an agent's password.
- **Prompt reading** (`models/prompt/`). A first reply on a phone CPU
  waits minutes while the model reads the agent's prompt. While an agent
  bound to a server has a working chat and the screen is on,
  `PromptWatch` asks that server's `GET /slots` every 2 s (with several
  busy at once, the first; the app shows one reading). A slot that is processing
  and has decoded no token is reading: `read` is
  `n_prompt_tokens_processed` (it grows once per 2048-token batch),
  `cached` is `n_prompt_tokens_cache`, and `total`, the new tokens to read
  in all, is `n_prompt_tokens_total` (the request's whole prompt, our
  llama.cpp patch: `lme/docs/README.md` → The slot's prompt total) less
  `cached`. Each change goes to the app (the event) and to the service
  notification (`notify/ReadingLines.kt`): "33%, 4.1k of 12.3k tokens".

## Run limits

By default any number of agents may run and any number of local models may
be loaded; the memory guard (below) keeps the phone from running out. The
user can set hard caps in Settings: `setRunLimits({maxAgents, maxModels})`
keeps them in the runner prefs (`limits/RunLimitStore.kt`, keys
`run_max_agents` and `run_max_models`; absent is no cap), so the
supervisor holds to them with no JS around. A cap is null or a whole number
1-99: `RunLimits.kt` (pure) rounds and clamps what JS sends, and anything
that is not a finite number is no cap. Both are read at each start:

- **Agents** (`EnginePolicy`): at the cap, a start stops the least recently
  used ready engine idle for a minute, and asks again; with none idle it
  is refused with `too_many_running` ("N agents are running, the most you
  set in Settings, …"). Engines stopping do not count.
- **Models** (`ModelSlotPolicy`): at the cap (servers loading or ready), a
  start whose model is not loaded is refused with `too_many_models`, once
  before the seat is taken and again when the server would start. Joining
  a loaded model never counts.

A cap lowered below what runs now stops nothing: it applies to the next
start.

## Memory guard

With no cap, the phone's memory is the limit. `memory/MemoryGuard.kt`
watches it while an engine or a model server runs, and when the phone
nears its peak the app warns and, unless the user stops agents
themselves, the runner stops one after a countdown. Every number is in
`memory/MemoryRules.kt` (`MemoryPolicyTest` pins them):

- **Reading.** Android's `ActivityManager.MemoryInfo` (`SystemMemory.kt`):
  `availMem`, `totalMem`, `threshold` and `lowMemory`. **warn** when
  `availMem` is under max(12% of total, threshold + 512 MiB);
  **critical** when `lowMemory` or under threshold + 128 MiB; back to
  **ok** only once it is at least the warn line plus 4% of total.
- **Countdown** (`MemoryPolicy.kt`, pure): 60 s from entering warn, at
  most 15 s once critical (easing back to warn gives the minute back).
  When it runs out, one agent is stopped; then 10 s for memory to settle,
  and if still not ok a fresh 30 s (15 s critical) for the next. Back at
  ok the episode ends and the next starts with the full minute.
- **Who goes** (`MemoryVictims.kt`, pure). Never one at work while an
  idle one can go: agents with no run going (their kind's idle rule; an
  engine still starting counts as working, its model may be loading for
  the task it was started for) first, and of those the ones with no job
  left running and not kept running (Jobs and the idle stop) first. Among
  equals, a stop that frees what the phone is short of (back to the ok
  line) goes first, least recently used first; else the one that frees
  the most. A stop frees the agent's processes plus each model only it
  holds (its server goes with it). The agent on screen while the app is in
  front (the one `setOpenChat` names) is spared, unless the one to go
  instead is at work; alone, or at work, it never goes. The notice names
  the jobs that went with an agent ("Claude Code (with npm run dev)").
  With nothing it may stop it keeps warning with no countdown. A stop is a
  user's stop (`stopped`, error `low_memory: stopped to free memory`), so
  a model server goes with its last holder.
- **Cost.** One thread, a look every 5 s only while something of ours
  runs, and at once when an engine starts or Android calls
  `onTrimMemory`/`onLowMemory` (Android 14+ no longer sends the running-low
  levels, so polling is the real signal). What each agent and model server
  takes (`ProcessMemory.kt`: PSS from `/proc/<pid>/smaps_rollup`, else
  `VmRSS`, summed over the processes tagged with the agent, or with
  `model-server` and the model id) is read only while the level is not ok
  or when the app asks.
- **Models stay clear of it.** lme-host sizes a model's start, prompt
  cache included, to leave free 16% of total RAM (where the guard is back
  at ok) plus 512 MiB for the agent's engine, so a model never starts the
  countdown by itself (`MemoryHeadroomTest` keeps the two in step).
- **To the app.** `phonecandoMemory` (`MemoryStatus.toMap`) on every level
  or countdown change, after an automatic stop (`lastAutoStop`: what it
  stopped, agents and the models that went with them) and on every look
  while not ok; `memoryStatus()` reads it now.
- **Notifications** (`notify/MemoryNotices.kt`, words in
  `MemoryLines.kt`): while PhoneCanDo is not in front, one warning per
  episode, then after each automatic stop one notice naming what was
  stopped (replacing the warning; later stops update it quietly). A
  warning nothing came of goes once memory is back or nothing of ours
  runs. A tap opens Home.

## Jobs and the idle stop

An agent's turn can end while something it started keeps running: a dev
server, `nohup … &`, opencode's "move to background", Claude Code's
`run_in_background`. Like a PC, that keeps running with the app in the
background, and the agent with it; an agent idle with nothing left stops
to free its memory. `engine/work/` does this for every kind, with no
per-kind code; every number is in `WorkRules.kt`.

- **Which processes are jobs** (`AgentWork.kt`, pure). An agent's
  processes are those tagged with its id (`PHONECANDO_AGENT`), or untagged
  and traced by its tagged proot (a guest that cleared its env). What ran
  when the user first spoke to the agent in this engine life (a viewer's
  first write to its TUI, `EngineTerminal.firstInputAt`, or its first
  activity event, `EngineSupervisor.firstInputAt`) is the agent itself:
  its program, a wrapper shell, the MCP servers it started up front.
  Anything born later and older than 10 s is a job, unless it is a stdio
  helper: not a shell, not started by a job, and its stdin a pipe the agent
  (or another helper) writes (`/proc/<pid>/fd` and `fdinfo`), or a socket
  from such a parent. That is how MCP stdio servers and language servers
  run, while commands get `/dev/null`, a terminal or a file. A shell, a
  command of the agent's own shell, an orphan or daemon (its parent gone)
  and whatever a job starts are jobs, except our kit's scripts
  (`WorkRules.KIT_SCRIPT`, `.phonecando/bin/phonecando-*` in a command
  line, such as Claude Code's Stop hook waiting in `phonecando-inbox
  --wait`) and what they run, which are the agent's helpers. Our own runtime is seen through
  (`WorkRules.RUNTIME_EXES`, by `/proc/<pid>/exe`): a native agent's command
  reaches the machine as our launcher (named like the command, `bash`
  too), then proot (which drops its stdin), then the program, so parents
  are read past the two, and each takes the verdict of what it carries (an
  MCP server opencode starts mid-session is a helper, a dev server a job).
  An agent with no run going whose process is 2 s old and a job by every
  rule but age is starting one (`WorkRules.STARTING_AGE_MS`): the
  notification names it until the 10 s decide, so the `npm run dev &` a
  run ended with holds the app before you switch to the browser; the watch
  looks again when it is decided, and for 10 s after a poke every 2 s
  while something younger is there (a hook a run ended with is gone by
  then, never named). In doubt it is a job: a wrong job
  keeps an agent up (the notification names it, with Stop), a wrong helper
  kills one. No spawn-shape rule works for every kind: `bash -c 'cmd'`
  execs the shell away, pi starts MCP servers detached, Codex runs each
  command in its own session.
- **Reading** (`engine/proc/DetailScanner.kt`, `ProcDetail.kt`): our
  processes' `stat` (parent, start in clock ticks since boot, CPU),
  `status` (tracer, name), `environ`, `cmdline`, the `fd/0` link and `io`.
  Starts become epoch ms through `elapsedRealtime`; `WorkWatches` logs the
  gap between the two clocks once at install. `/proc/net` is closed to
  apps, so the rule never asks what is on a socket's other end.
- **The watch** (`WorkWatch.kt`). While an engine runs it looks every
  30 s (at once when one starts): judges each agent's processes, names its
  jobs (`WorkNames.kt`: the program and two words, stopping at anything
  that may carry a value), and measures whether they do something
  (`WorkMeter.kt`: CPU or bytes read and written since the last look; a
  dev server waiting for requests does not; a process is known by pid and
  kernel start ticks). Each process's verdict is logged once decided and
  whenever it changes, `[phonecando-work] <agent> <pid> <verdict> <name>
  (<why>)` on tag `PhoneCanDoWork`.
- **The idle stop** (`ReclaimPolicy.kt`, pure). With the app in the
  background, an agent stops (as a user stop: it and all it started) once
  it is ready, idle by its kind's rule (`isIdle`: no activity for
  `quietSec`, never with a chat working), has no job, is not kept running
  and has not asked to stay up, the app has been away for its quiet time (a look at the agent's dev
  server in the browser stops nothing) and its last job ended that long
  ago. Nothing stops while an agent drives the screen (the bridge's screen
  lease, `Bridge.screenInUse`: it may just have put PhoneCanDo in the
  background), nor once the app is back in front.
- **Keep running** (`KeepRunning.kt`, the runner's prefs; the agent page's
  switch through `keepRunningFunctions`): the idle stop leaves the agent,
  and the memory guard stops it after the agents with nothing to do. A
  deleted agent leaves the set.
- **An agent's own ask** (`KeepAsks.kt`; the `agents_keep_running` tool,
  bridge route `/keep`, `KeepRoutes.kt`): an idle agent that must stay
  reachable (it asked another agent something and wants the answer to
  start its next turn: a message starts a stopped agent only when it asks
  to wake it, the switch allows it and the phone has room; a CI run
  it waits for) asks to stay up, with a reason, for 30 minutes or as many
  as it names, at most 120, and may ask again. It counts as Keep running
  (the idle stop leaves it, the memory guard stops it after the agents with
  nothing to do) but is never saved: it ends at its time, when the agent
  sends `on: false`, or when its engine stops (`WorkWatches`). It never
  touches the user's switch; the agent page shows it under the switch
  (`keepRunningAsk`).
- **Notification.** An agent kept up between chats has a line, "Claude
  Code · running npm run dev", "… · kept running" or, for its own ask,
  "… · kept running: waiting for Tester's answer (until 14:30)", and a
  Stop button (`ACTION_STOP_AGENT`) that ends it and its jobs.
- **Wake lock** (`power/WorkLock.kt`). The service keeps the process
  alive, not the CPU: screen off, the phone sleeps under a running agent
  and it crawls. A partial wake lock is held while an engine starts (a
  message's or a task's start may come with the screen off), a chat works,
  a model server reads a prompt, a model or Linux job runs, or an agent's
  job did something in the last minute; never for an idle agent. Each hold lasts
  10 minutes and is renewed on every change and every look, so one nobody
  renews ends by itself.
- **Device-checked** (Android 16, 2026-11-12): `fd/0`, `fdinfo`, `io`,
  `TracerPid` and `environ` of proot's guests read fine, a guest's
  `cmdline` is its own (not proot's loader), and a start in `/proc` is
  within 0.1 s of `elapsedRealtime`. A nohup'd server kept its agent up
  with the app away, the notification's Stop ended both, and an agent
  whose `sleep 120` ended stopped a minute later. Still owed: that the
  wake lock holds in deep Doze (hours, screen off, unplugged).

## Foreground service and lifetime

`PhoneCanDoServeService` anchors the engines while the app is in the
background, and the process while a job runs: a model download or import,
or a Linux job (an env download, a machine's setup or reset, an agent
install). It runs the start requests, holds for jobs (`ACTION_HOLD` from
`jobs/JobsAnchor.kt`; `models.md` → Jobs), shows one notification per
agent at work, each with its own tap and Stop buttons (its chats; kept up
by a job it left running or is starting, by Keep running, by its own ask
or at work unseen, `WorkLines.kt`, Stop: `ACTION_STOP_JOB`,
`ACTION_STOP_AGENT`; starting; stopping; `notify/AgentItems.kt`) and one
per job, each with its bar: the model server reading a prompt, the model
jobs and the Linux jobs with the share the app's bar shows for them (a
download's wait for a network or its next try and a re-read said as the
app says them; a machine's setup over the whole setup; an agent's install
or update with the share its bar shows in the app, which the app tells the
runner, `notify/InstallShares.kt`, and which redraws it at once), bundled
under its own notification, which counts them; with none of that, its own
is the agents ready (`notify/ServicePlan.kt`, `ServiceItems.kt`,
`ServiceNotification.kt`, `ReadingLines.kt`, `TransferLines.kt`,
`LinuxJobLines.kt`, `JobLines.kt`, `ReadyLines.kt`, channel
`phonecando-engine`; see Notifications), keeps the CPU awake while any of
that works (`power/WorkLock.kt`; see Jobs and the idle stop) and stops
itself once neither an engine nor a job has run for 10 s. The wait
matters: work often follows at once (an agent's install starts as its
machine's setup ends), by then the app may be in the background, and there
Android refuses a new start of the service, so the next job would run
unheld and the process freeze (seen on the phone before the wait). Every
command answers `START_NOT_STICKY` and a null-intent restart starts
nothing.

It is in the foreground, with its notification, while anything of ours
runs: an engine (idle ones too, listed as ready, which also covers the
model servers, as each runs only while an agent holds it), an engine
starting, a model or Linux job. Out of the foreground with the app away,
the process is a plain service's: Android stops the service about a
minute later ("Stopping service due to app idle") and every engine with
it (`onDestroy`), before the idle stop would; and away, Android lets the
service back into the foreground only in an exemption's window (an
alarm's), so work that starts later (a message that wakes an agent, Run
now and then leaving the app) was refused (`Background started FGS:
Disallowed`; both seen on Android 16). Staying in the foreground
changes nothing about how long an agent runs: the idle stop, Keep
running and the memory guard decide that (see Jobs and the idle stop), and
the notification only names what runs. Each `startForegroundService`
gets its `startForeground` (with an empty notification when nothing runs
yet, which Android 12+ holds back for some seconds). Once nothing runs at
all, `render` leaves the foreground (`stopForeground`): at once with the
app in front, where it may come back any time, and after the same 10 s of
still nothing with the app away, where Android refuses a later
`startForeground` just as it refuses a new start; the service then stops
(`stopIfIdle`).

`JobsAnchor` listens to the models module's jobs and to `LinuxHost`'s
(their begin and end at once, their progress at most every 1 s). When a
job runs and the service is down it starts the service; the service tells
it when it starts and ends, so a service gone while jobs still run is
asked for again on the next job event. A refused start (Android lets a
background app start none) is tried again only when another job begins
(`jobs/HoldRule.kt`, pure). A job the service could not hold still runs
while the process lives and resumes later where it stopped.

The service's type is `specialUse`, which Android gives no time limit.
`dataSync`, which we used before, gets 6 hours in any 24 on Android 15+
while the app is in the background; with `dataSync` anywhere in a
service's types the limit applies (AOSP `ActiveServices`
`getTimeLimitedFgsType`). Below Android 14, where `specialUse` does not
exist, the service starts with the manifest's type.

Lifetime is quiet-when-idle and follows the UI. `App.tsx` starts the active
agent's engine on launch and on every return to the foreground
(`src/state/agents.ts` `startAgent`: prepare its image, then
`ensureEngine`); the web UI and the terminal start it when they open; other
agents' engines start only when something uses them. With the app in the
background the runner stops an agent once it is idle and nothing it
started still runs (see Jobs and the idle stop). A start, a chat in front (`useEngineTouch`,
every two minutes), each bridge call and each engine event mark an engine
used, so it is not the one stopped to make room (under the user's cap) or
to free memory (the memory guard).

`onTimeout(startId, fgsType)` should therefore never come; it stays for a
limit a later Android may set. At a limit Android crashes the whole
process unless the service stops within seconds. The service then stops
posting its notification (a repost would come back as a plain one nothing
removes), removes it, calls `stopSelf()` and, when engines run, stops them
all on their own thread (one 3 s grace) with `TIME_LIMIT_REASON` on their
statuses, like the memory guard's reason, and posts a notice
(`notify/TimeLimitNotice.kt`, id 4102 on the agents' channel) that says
the agents stopped. The bridge closes with the last engine; jobs keep
running while the process lives. Nothing restarts the engines in the
background; the app starts the active agent's engine again when it next
comes to the foreground.

## Notifications

Everything an agent posts goes on the `phonecando-agent` channel through
`notify/AgentNotices.kt`, tagged with the agent's id, so one agent's
notification never replaces another's. Per agent, one slot (id 4500)
holds its "come back to me" notice, the `/app` return notice or an alert
(below), so there is never more than one; its own posts (`/notify`) take
4600-8695, one per title, its prompts 9000-9255, its links to open
9300-9363, a due task 9400 (Schedules), a run cut off 9470 (Cut-off runs)
and its permission questions 9500-9563. The engine service (4101; its
items 4103, tagged `phonecando-item:<key>`), its time-limit notice (4102, on the
agents' channel; see Foreground service and lifetime), the update notice
(4202) and the memory guard's notice (4301, on the agents' channel; see
Memory guard) are untagged.

- **Where a tap lands.** A `LaunchTarget` names a place (`home`, `env`,
  `checks`, `settings`, `models`, `updates` or `memory`: Home, the agent's
  page or the systems list, the agent's checks, Settings, Models, Settings'
  Updates, the RAM warning; an open terminal stays on top of any) plus,
  when the reason is one agent, that agent (`ui/nav/launchTarget.ts` in
  the app). Every agent notification's tap, the engine notifications'
  (each item's own; the bundle's head, `notify/ServiceTap.kt`), the memory notice's, the update notice's and
  the bridge's own launch start
  `notify/OpenTargetActivity` (non-exported, `Theme.NoDisplay`,
  `noHistory`) with the target in its intent; it hands the target over
  (`LaunchTargets.deliver`: the runner prefs plus the
  `phonecandoLaunchTarget` event `{tab, agentId}`), starts the app and
  finishes in `onCreate`. So the target is bound when the app opens, and
  two agents' notifications each open their own agent. Each target's
  intent carries its own `Intent` identifier (part of `filterEquals`, API
  29+), so every target gets its own `PendingIntent`. The app reads the
  target from the event, or with `consumeLaunchTarget` (read and cleared
  once) on launch and on every return to the foreground once the agents
  are read (`App.tsx`), makes the agent active when it exists and shows
  the tab. A trampoline rather than an Expo activity listener on
  `MainActivity`: Android recreates an activity after its process died
  with the intent that first created it, and `MainActivity` hands React a
  null saved state, so a listener would replay an old tap; the trampoline
  reads each tap once and is never restored. Recents replays
  (`FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY`) carry no target.
- **The service's notifications list agents at work and jobs, not
  engines.** Each agent at work has its own, titled with its name, a tap
  on its Home: one line per chat, its title then its state ("Working",
  "Waiting for your answer", "Stopped with an error", "Done"), waiting
  first and newest first within a state, then what keeps it up, with its
  Stop buttons (three at most), and "Starting" or "Stopping…". Each job
  has its own, with its bar and a tap on its place. They bundle under the
  service's own (`setGroup`, which is the group summary): the counts ("1
  waiting for your answer · 1 job running"). Only one that changed is
  posted again (Android drops an app's updates past about five a second);
  they are plain notifications, so the service's first start takes down
  any an earlier process left. The lock screen gets each one's public
  version: counts or the kind of thing, no names or titles.
  With no chat, job, start or stop to list but engines running, it is one
  quiet line naming them, "Claude Code, opencode ready" (three names at
  most, then "and 2 more"; `notify/ReadyLines.kt`, pure), with no buttons,
  on the same low-importance channel (no sound), and "2 agents ready" on
  the lock screen; a tap opens the app, on that agent's Home when one
  runs. It is what keeps the service in the foreground (see Foreground
  service and lifetime). With nothing running there is no notification.
  `notify/ChatBoard.kt` (pure) keeps the
  board from the same events as the alerts: a top-level session shows from
  its first activity; done and error stay until the user opens that
  agent's chat (`dismissAgentAlert`) or its engine stops or dies, at most
  four of them; a run the user stops (`STOPPED`: opencode
  `session.execution.interrupted`) or a deleted session leaves; a
  subagent's child session shows only while it waits for an answer. The
  chat on screen shows while its run goes, like any other: it is something
  happening. The app reports it (`setOpenChat`, from `useOpenChat.ts`: the
  web UI on a chat, Home with nothing over it, app in the foreground; null
  otherwise), a run that ends while it is open counts as seen, and opening
  a done or error chat sees it. An agent TUI in front reports its chat by
  the title it gives the terminal (`ui/terminal/useOpenTuiChat.ts`, the
  kind's `chatTitle`: opencode writes `OC | <title>`, cut to 37 characters
  and "…" past 40); the board sees it only when exactly one of that
  agent's chats fits, so a fresh untitled chat or two with the same title
  stay listed as done; a title that fits none makes the tracker read that
  agent's titles again.
  `notify/ChatTracker.kt` reads titles from the engine (the manifest's
  `chats.title`: opencode `GET /api/session/{id}`, `/data/title`; the
  stream carries a title only on create and rename) when a chat first
  shows, starts a new run and finishes, one loopback GET at a time on its
  own thread; a rename (opencode `session.renamed`, often after the first
  run has ended) updates it straight from the stream; a chat without one
  yet reads "New chat". A server kind with `chats.active` (opencode
  `GET /api/session/active`, `/data`: its running sessions as keys) has
  its stream checked against it (`engine/events/ActiveChats`, on the
  events timer): once the agent has shown no activity for its
  `idle.quietSec` while a chat shows working, the server is asked, at most
  once per that span, and each working chat it does not name ends as a
  guessed stop (no alert, no sign of use, the checks skip it). A long
  quiet command stays: the server names its chat. The service re-renders
  only when the board changes (`Engines.Listener.onChats`), never per
  token. A tap opens the app on what it lists (`notify/ServiceTap.kt`,
  pure): a model job on Models, an agent's install or its machine's setup
  on the agent's page, a system's download on Systems, the update download
  on Settings' Updates, an agent kept up, starting or stopping on its
  Home; when the lines are about several places, on that agent's Home
  when every listed chat is one agent's, else the app as it was.
- **Agent alerts.** `EngineStreams` passes every engine event to
  `notify/AgentAlerts.kt`; `notify/AlertRules.kt` (pure) decides. A
  top-level session's verdict (`FINISHED`, `FAILED`) and any session
  waiting on the user (`WAITING`: opencode `permission.asked`,
  `form.created`) alert; a subagent's child session (its `session.created`
  has a parent) never alerts on its verdict; an interrupted run
  (`STOPPED`) never alerts; the same alert for the same session comes once
  until that session moves again. A waiting alert is over once its session
  moves on (`WORKING`: answered, from a notice or the app; a verdict,
  `STOPPED` or `GONE`): it goes, unless a new alert takes the slot, and
  only while the slot still shows it (not the `/app` return notice). While
  a Check now runs for the agent, or its engine is not released yet
  (`CheckNow.owns`), nothing alerts and no finished run goes to the app:
  the check's own notices say how it went. Nothing posts while PhoneCanDo is in
  front (an activity on screen). The alert goes in the agent's slot,
  titled with its name: "Finished. Tap to see the result.", "Stopped with
  an error. Tap to see what happened." or "Waiting for your answer."; a new
  one replaces the last and makes no sound while the last is still
  showing. A tap opens the agent's Home; showing that agent's chat takes it
  down (`dismissAgentAlert`, from `useEngineTouch`: a call of its own,
  since `touchEngine` also runs for engine starts that show nothing). An
  agent that is waiting while it drives the phone (it holds the screen in a
  run still going, not given back with `/app`: `Bridge.screenHolder`;
  `bridge.md` → Screen lease) also brings
  PhoneCanDo forward on its Home, so the question is not left behind the
  app being automated; the alert still goes up, as the way back if Android
  blocks the background start. A new engine life starts with fresh rules
  for the agent; deleting an agent takes down all its notifications.
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
  (`Wants to open <host>. Tap to review.`) that opens the agent's Home and
  goes when the prompt ends. The same link from the same agent while one
  waits adds nothing; an agent keeps at most four (a new one pushes out
  its oldest), and its links go when its engine stops.
- **Permission questions** (`prompts/PermissionPrompts`,
  `PermissionRegistry`): an agent in ACP mode asks before a tool runs
  (`session/request_permission`; see Engines → ACP mode). The question
  becomes a `permission` prompt beside the bridge's (`pendingPrompts`, the
  `phonecandoBridgePrompt` event) with `title` (what it asks to do),
  `toolKind` and `options` (`[{optionId, name, kind}]`, kind ACP's
  `allow_once`, `allow_always`, `reject_once` or `reject_always`); its
  `requestId` is the ACP driver's, unique in the process, the same one the
  background view shows (`acpSnapshot`, the `phonecandoAcp` event). The
  app answers with `resolvePermission(requestId, optionId | null)` (null
  cancels it; false when it is gone or the answer is not one it offered).
  While PhoneCanDo is not in front it is also a notification ("Asks for
  your OK: `<what>`") whose tap opens the agent's Home, with two buttons:
  Allow (the first `allow_once` answer, else the first `allow_*`; Android
  12+ asks for the phone to be unlocked first) and Deny (the first
  `reject_*` answer, else cancel). The buttons go to
  `PermissionActionReceiver` (not exported; our own `PendingIntent`s, one
  identifier per question and answer). The question and its notification
  go when it is answered, the agent takes it back, its turn ends or its
  engine stops. The run's own alert ("Waiting for your answer.") still
  goes up in the agent's slot beside it, and goes once the question is
  answered (Agent alerts).
- **ACP turns for the app** (`acp/`): `AcpRelay` is the one
  `AcpEngines.listener`, set once per process when messaging is first
  made (every engine start makes it first) or the app's module is. It
  sends items, busy and turn ends to the app as the `phonecandoAcp` event
  (`AcpAppEvents`: `{agentId, type:"item", item}`, `{agentId,
  type:"busy", busy}`, `{agentId, type:"permission", permission}`,
  `{agentId, type:"permissionGone", requestId}`, `{agentId,
  type:"turnEnd", stopReason, error}`; an item's updates within 150 ms go
  as one, and every other event first sends the items that wait),
  questions to the permission prompts, a turn's end to Schedules and no
  turn running to Messages. `api/AcpFunctions.kt`: `acpSnapshot(agentId)`
  (`AcpSnapshot.toMap`, null in terminal mode or not running),
  `acpCancel(agentId)` (false when no turn runs) and `resolvePermission`.

## Messages

Agents talk to each other through the bridge's `agents_*` tools
(`bridge.md` → Agent messages): any agent may list and message any other
on the phone. How far a message reaches an agent is its kind's level
(kit `MessagingLevel`: wakes, delivered, inbox, none; `AgentsView.kindLevel`;
a kind with an ACP mode and phone tools is wakes):
a message to an agent whose kind has no phone tools (none) is refused,
and logged so with the reason, never queued for good; a kind that wakes
through a hook it leaves waiting after a turn (`inbox.wake` "hook") can be
woken only while that hook's `waiter` file is there (`AgentsView.wakeReady`). The runner keeps the messages and hands each recipient its
own (`messages/`: pure apart from `Messages`, `LiveAgentsView` and the
inbox folder's IO).

- **Log** (`MessageStore`, `MessageLog`): `files/state/messages.jsonl`,
  app-private and never inside a machine: one JSON line per change of a
  message, the last line of an id wins, compacted on start (the newest
  500, none older than 7 days, after a `{"seq":N}` line so ids go on when
  all aged out). A message has its sender (agent id, the name, kind and
  machine it had then; `runner` for a notice), its target (an agent,
  `@machine:<imageId>` or `@phone`), text, `replyTo`, `sentAt`, `hop`,
  `wake`, `notice`, and per recipient a delivery: queued, then delivered
  (posted to its server, or claimed by its hook before the receipt came),
  then read (its receipt, `agents_inbox` or `agents_wait`); refused only
  when dropped unread. A delivered message that asked to wake its
  recipient and did not keeps why (`reason` "not woken: it is busy"), and
  its sender hears "in its chat; not woken: …; it reads this at its next
  turn". Unread is queued. Deleting an agent drops the
  messages to it; what it sent stays under its name.
- **Rules** (`MessageRules`, `MessagePolicy`; `MessagePolicyTest` pins
  them): the text is cleaned (`MessageText`: control, bidi, zero-width and
  tag characters go) and refused, never cut, over 4000 characters; direct
  messages 5 a minute and 30 an hour per sender and recipient, broadcasts
  2 a minute and 10 an hour per sender; the same text to the same target
  within a minute is dropped; past 50 unread an agent's oldest are dropped,
  with a notice. A name two agents share is refused with both ids, which
  always work (`Addressing`).
- **What a model reads** (`Renderer`): one `<agent-message from="Name
  (Kind)" where="your machine|another machine" id=".." reply-to="..">`
  block per message, labelled as another AI agent's and never the user's,
  a runner notice as `<phonecando-notice>`, then how to answer; a tag
  inside a text is escaped. One hand-over (`Parcels`) takes the oldest
  unread that fit about 8 KB (at least one) and ends with "N more agent
  messages waiting: call agents_inbox." when some wait, as hook runners
  cut long context and a printed message counts as read.
- **Delivery** (`Mailbox` over `delivery/RoutingCourier`): for a kind
  with an ACP mode, the way `AcpRoute` (pure) picks by what its engine
  does now (below); for every other agent the `InboxCourier`, as the
  kind's `inbox` block says (`KindInbox`, over the kit's
  `ManifestKind.inbox`, `renderInboxHook` and `inboxRequest`), again on
  every new message, engine start and ready, chat-board change, read,
  receipt and ACP turn end:
  - hooks or a reader: `<home>/.phonecando/inbox-<agentId>/pending/`
    (`InboxFolder`; `PHONECANDO_INBOX` names the folder, `/root/…` for an
    image kind): `ids`, `messages.jsonl` (one item per line, with its
    rendered `block`), `messages.txt`, `<Event>.out` and `<Event>.exit`
    per declared hook event, and `wake` when the set may wake the agent;
    built aside and swapped in whole. `phonecando-inbox <Event>` claims it
    (a rename), prints it and writes the `@inbox\t<ids>` receipt to the
    events file, which marks them read. A set claimed before its receipt
    is read (our `pending/` gone, or its ids in a `claimed.*` folder) is
    marked delivered and left out of the next. The script's `waiter` file
    is left alone while the engine runs; an engine start makes the folder,
    removes `claimed.*`, our half-done folders and the `waiter` an earlier
    life left (its hooks went with its engine, and a stale one would read
    as a hook ready to wake the new one), and writes the set.
  - a server: POSTed to the engine's own loopback server with its
    password, into its working chat, else its latest (`ChatBoard.latest`):
    the `wake` call when the set may wake it and the kind wakes through its
    server, else `deliver`. A 2xx is delivered; with no chat yet or a
    failure they stay queued, tried again on the next chat-board change
    or start (15 s after a failure).
  - no block: nothing; the agent pulls with `agents_inbox`, and every MCP
    result tells it when some wait.
- **ACP delivery** (a kind with `engine.acp`; Engines → ACP mode). Its
  hooks and reader still run in ACP mode, so a set may still reach a
  running turn; a prompt is the floor that wakes an idle one:
  - ACP mode ready, no turn running, and the set may wake it: its folder
    is cleared (a hook mid-turn must not print it again) and the set goes
    in as one prompt (`AcpCourier`: in a new chat titled as the task when
    a scheduled task asks for one, else the current chat): delivered,
    woken. An engine started for a message is busy until its first
    prompt (`waitingForWork`) and takes it. A refused prompt is tried
    again on the next turn end, ready or chat-board change (15 s after a
    refusal). A runner notice (a scheduled task) another hand-over took
    between its logging and its own (the messages thread, as a turn
    ended) reports how that one went (`Mailbox.notice`).
  - ACP mode, a turn running or a set that may not wake it: its folder
    when its hooks or reader read one (claimed mid-turn or next turn),
    else it waits (`agents_inbox`). A set left in the folder of an agent
    in ACP mode never carries the `wake` mark (`AcpRoute.folderWake`): a
    waiting hook (Claude Code's `Stop` with `--wait`) or a reader (pi's
    `pending/wake`) would start a turn outside ACP. In ACP mode only our
    prompt wakes it.
  - terminal mode ready, idle, nobody with its terminal open (nor Home
    opening it: Engines → ACP mode → Switch), no jobs and not kept
    running, and the set may wake it: we ask its engine to
    switch to ACP mode (`EngineStarts`, mode ACP) and the sender hears
    woken (`Handover.SWITCHING`, still queued); once ACP mode is ready
    the set goes in as a prompt. Asked again only after 30 s; a switch
    that never came, or that Android refused, leaves sets to the folder
    as today for 10 minutes.
  - anything else (terminal mode with the user watching, a run or jobs;
    starting or stopping): the folder as today, the `wake` mark too in
    terminal mode, so a waiting hook may still wake it in place.
  An ACP turn counts as working for its state (`LiveAgentsView.presence`)
  even before the chat board shows it. `agents_list`'s `canWake` follows:
  idle in ACP mode or free to switch counts as ready to wake, and so does
  a stopped agent a message may start (below).
- **Waking.** A set may wake its agent when one of its messages is direct
  (or a notice that may wake), asked for it under 10 minutes ago, has hop
  under 2, and its agent has "Other agents can wake it" on (`wakeable`,
  `setAgentWakeable`), is of a kind with `inbox.wake` or an ACP mode, runs
  with no run going and no question waiting, or is stopped and may be
  started for it (below), and was woken under 6 times this hour (a start
  counts as a wake; the budget is read back from the log on start). The agent was woken when such a set was claimed while it
  had no run going, its server took the wake call, or it went in as an
  ACP prompt. From then until
  that run ends (it leaves the working chats, its engine stops, or no run
  shows within a minute) it is `startedByAgent` (`WakeTracker`): the screen
  line refuses it the screen unless the line handed it over, and what it
  sends carries the cause's hop + 1.
- **An answer wakes its asker** (`MessagePolicy.answerWakes`). A direct
  message whose `replyTo` is a message that asked to wake (wake: true,
  direct, not a notice), sent by that message's recipient back to its
  sender, asks to wake as if sent with wake: true: an agent that asked and
  ended its turn hears the answer, as `agents_wait` gives up after 30 s and
  a woken or started agent may take minutes (its start, a local model
  reading its prompt). The rules above still hold: the asker's switch, the
  answer's own age, the budget, a stopped asker's start, and the hop (an
  answer from the woken run is hop 1 and may wake; an answer to it is hop 2
  and never does). A busy asker gets it in its turn as any message, or
  woken once idle within the 10 minutes. So a sender whose message woke or
  started its recipient hears to end its turn rather than wait
  (`SendReport.DONT_WAIT`), and what a model reads of its messages
  (`Renderer`, and `agents_inbox`'s note) says to answer with `replyTo`.
- **Starting a stopped agent** (`messages/start/`; `StartRules` and
  `MessageStarts` pure). The idle stop stops an idle agent a few minutes
  after you leave the app, so a new direct message that may wake it (the
  rules above) also starts it when stopped: a kind with an ACP mode in ACP
  mode, with no first prompt (busy until its work comes,
  `waitingForWork`); a kind that wakes through its server (opencode) as
  usual. Once it is ready the unread set goes in as one prompt, or through
  the server's wake call, and each delivery reads `started` as well as
  woken. Any other kind (Codex, never woken while idle) is never started:
  its messages wait for its next run. Not while a check found its waking
  does not work now (its level now below wakes), a Linux job runs on its
  machine (Update agent, a setup), Check now has it (between its parts a
  start could take the check's first prompt), Home is opening it, its
  last start failed or an ACP turn of it went silent under 10 minutes ago
  ("it failed under 10 minutes ago (why)"; `engine/starts/StartHolds`,
  shared with Schedules; any start of it that comes up ends the hold), the
  memory guard stopped it under 10 minutes ago (`memory/MemoryStops`), or
  the phone has no room
  (`engine/starts/StartRoom`, pure: free memory under the guard's ok line
  plus 512 MiB for its engine, `MemoryRules.START_ROOM`, the room lme
  leaves an engine beside a model; or as many agents running as your cap,
  where it is refused rather than stopping an idle agent of yours). A stop
  you made is no reason. Only a send starts it, never a retry (an engine
  or chat change, or a set built while it still ran), so an agent you just
  stopped stays stopped until the next message. The sender hears woken ("it was stopped; it starts in the
  background to read this", `Handover.STARTING`), or queued with why not
  ("not started: …", Android refusing the request too: that holds
  nothing back). Until its engine is gone the agent counts as starting, so
  a burst asks once and goes in as one set; the service taking the request
  (`Engines.Listener.onStartTaken`) marks the start begun, however long it
  waits its turn behind other starts or a model's load. A start that fails
  (the service refuses it before any status, `onStartFailed`; its engine
  fails or dies before ready; or the service never takes it within a
  minute) holds the agent back for 10 minutes and tells each agent whose
  unread message asked to wake it, in a notice that never wakes ("Tester
  could not be started for your message: …"); the messages wait for its
  next run. A started agent stops again as any idle
  one (the idle stop, once its turn is done and the app has been away its
  quiet time); the wake lock holds the CPU while its engine starts and
  while its turn works.
- **Screen line** (`ScreenMessages`, the bridge's `ScreenNotices`): the
  holder hears once per waiter that someone waits; the next in line hears
  the screen is kept for it, which may wake it as above.
- **Threads.** `Messages` (one per process) is made by the first engine
  start (`EngineLauncher.plan` writes the agent's set) and hears the
  engines (`Engines.Listener`); it runs those reactions, receipts and the
  screen notices on its own thread, a burst of chat-board changes once.
  Sends and reads run on the bridge's request thread; `agents_wait` holds
  only its own request's thread, at most 30 s.

## Schedules

You (the Schedules page) or an agent for itself (`schedule_add`,
`bridge.md` → Schedules) set a task for an agent, once, every N minutes or
daily at a time; at its time the runner gets it to the agent, starting it
if needed, with no JS around (`schedule/`: pure apart from `Schedules`,
the store's files, the alarm, the receivers and `LiveFireState`).

- **Model** (`Schedule`, `ScheduleJson`): `{id, agentId, text, timing:
  {type:"once", at} | {type:"every", minutes, anchor} | {type:"daily",
  time:"HH:MM", days}, chat:"new"|"same", on, by:"user"|"agent", createdAt,
  nextAt|null, lastRun:{at, outcome, detail?}|null}`, epoch ms. A daily
  time is worked out in the phone's zone when it comes up (`NextRun`, by
  java.time: a time the spring change skips runs that much later, one the
  autumn change repeats runs once); every N minutes keeps to the grid from
  its anchor. Chat defaults: same for a once, new for a repeat.
- **Rules** (`ScheduleRules`, `ScheduleCheck`; `DueRulesTest` pins them):
  text cleaned as messages are, 1 to 4000 characters; a once in the
  future, at most 366 days ahead; repeats every 15 minutes at most often;
  20 schedules per agent, 10 of them set by the agent. A text you rewrite
  makes the task yours (`by` user). Off, an agent's "Can schedule itself"
  (`SelfScheduling`, runner prefs, on by default) refuses its
  `schedule_add`; it may only cancel what it set. A kind with neither a
  start prompt nor a wake nor an ACP mode cannot run tasks (kit
  `runsSchedules`) and gets none.
- **Store** (`ScheduleStore`, `ScheduleRuns`, `StateFile`):
  `files/state/schedules.json` (the schedules and their waiting firings,
  written whole and atomically) and `files/state/schedule-runs.jsonl`
  (`{seq, scheduleId, agentId, agentName, text (first 200), by, dueAt,
  firedAt, late, outcome, detail?, open?}`, the newest 200; `open` while
  the start or ACP turn the run began still goes). Deleting an agent
  drops its schedules; its runs stay under its name.
- **The alarm** (`ScheduleAlarms`): one AlarmManager alarm for the soonest
  time the book needs (a due time, a retry, a busy deadline), armed again
  after every change and firing, on first use in a process, and by
  `ScheduleBootReceiver` on boot, app update, clock or zone change (a daily
  time's next run is worked out again) and when "Alarms & reminders" is
  granted. Exact (`setExactAndAllowWhileIdle`) once you allow it
  (`SCHEDULE_EXACT_ALARM`; `scheduleAlarms`, `openAlarmSettings`), else
  inexact (`setAndAllowWhileIdle`), which may run late and may not start
  the engine service from the background.
- **Due** (`DueRules`): a due one runs once, marked late past 2 minutes;
  more than 24 hours late (the phone off, the process dead) it is logged
  `missed` and not run. Either way its next time is the first after now:
  missed runs are never replayed.
- **Firing** (`ScheduleAlarmReceiver` → `Firing`, on the scheduler's own
  thread inside the broadcast's `goAsync`): the agent as it is now
  (`LiveFireState`) decides (`FireRules`):

  | Agent | Action |
  | --- | --- |
  | **kind with an ACP mode:** engine stopped | start in ACP mode with the task as its first prompt (`started`) |
  | engine starting or stopping, or busy (an ACP turn, a run, a question) | wait until idle; 2 h past due `busy` |
  | ready in ACP mode, idle | the task as its next prompt (`woke`) |
  | ready in terminal mode, idle, nobody with its terminal open, no jobs, not kept running | switch to ACP mode with the task as its first prompt (`restarted`; PhoneCanDo open is no reason to wait, Home shows the run live) |
  | ready in terminal mode, idle, someone using it or jobs left, its hook waiting, same chat | wake it with the task in place, as before ACP mode (`woke`) |
  | ready in terminal mode, idle, otherwise | ask you (`asked`) |
  | **any other kind:** engine stopped, kind takes `engine.prompt` | start with the task as its first prompt (`started`) |
  | engine stopped, kind wakes through its server | start, then wake with it (`started`) |
  | engine starting or stopping, or busy (a run going, a question waiting) | wait until idle; 2 h past due `busy` |
  | ready, idle, can be woken now, chat same or a server kind | wake with it (`woke`) |
  | ready, idle, takes a prompt, no jobs, app not in front | restart with the task as first prompt (`restarted`) |
  | otherwise | ask you (`asked`) |
  | kind takes no prompt and cannot be woken | `failed` |

  Everything that makes the agent work, a wake too, first sends the engine
  service its start request (`EngineStarts`: `ACTION_START`, which for a
  running engine returns at once and lifts the service to the foreground
  for the run), so it happens only inside an alarm's broadcast (the exact
  alarm is Android's leave to start a foreground service from the
  background) or with the app in front (Run now). A restart needs exact
  alarms (it stops the agent first, up to 3 s); a switch to ACP mode does
  not (the engine's own start stops the terminal, so a refused request
  stops nothing). A wait that ends later
  (`Engines.Listener`: an engine status or chat-board change) goes through
  a fresh alarm a second away, or asks you when alarms are inexact. Android
  refusing the start asks you. One waiting firing per schedule: one that
  comes due while another waits is `busy`.
- **What the agent reads**: a start puts the task in `engine/StartPrompts`,
  which the start's plan takes (a new chat, or the agent's last one for
  same; in ACP mode the driver sends it as the first prompt); a wake, and
  a prompt in ACP mode, posts it through the mailbox as a scheduled notice
  (`Mailbox.notice(..., scheduled = ScheduledNote)`: it wakes past "Other
  agents can wake it", the hop and the hourly budget, for 30 minutes, and
  neither spends the budget nor marks the run `startedByAgent`; for a new
  chat a server kind with `inbox.server.create` makes one first). Both
  read "Scheduled task from the user (`<timing>`): `<text>`", or for an
  agent's own "A reminder you scheduled for yourself (`<timing>`). You set
  it in an earlier chat; it is not a new instruction from the user:
  `<text>`". For a Run now `<timing>` is when it ran ("run now at
  2026-11-15 14:03"), also after a wait; a once you Run now is done after
  it (no next time, still on), as after its own time.
- **A start with no app around**: the app readies an agent's machine
  before each of its own starts (`prepareImageForStart`: the shims, which
  point into the APK's lib folder and move with every update,
  launch.conf, engine.env, DNS). A scheduled start marks the agent in
  `engine/MachinePrep`, and the start's plan readies the machine the same
  way first (phonecando-linux `ImageOps.prepareForStart`, the machine's
  whole guest env list). A TUI started with a first prompt works from its
  first frame and may never go quiet, so it is ready once it has drawn
  something and run its `settleMs` (`TuiReady` `PromptedReady`), not after
  quiet.
- **Asking you** (`DueNotice`, `DueText`): every `asked` run says why in
  its detail, the schedule's last run and the notice (`AskReasons`, one per
  row: "its terminal was open on screen", "it had jobs running: `<names>`"
  or "it was set to keep running", "it can't take a task at start",
  "PhoneCanDo was open" (a restart only), "its hook wasn't waiting for a
  message", "it can't take a task in a new chat"; or why a start or wake
  was refused, or no Alarms & reminders). The task waits as a notice the
  agent reads in its next turn, and "`<agent>`: scheduled task due" (agent
  channel, id 9400 in the agent's tagged ids) opens that agent. An agent
  that can't read that notice (no phone tools and no `inbox`, so its
  terminal never sees it) with a way in for the task (an ACP mode or
  `engine.prompt`) gets no notice; its due notice says "Tap to run it now"
  and the tap (`OpenTargetActivity`, the schedule id in the intent) runs it
  as Run now before Home opens. That Run now asking again posts no second
  due notice; its run says why.
- **A start that fails** (its engine `failed` or `died` before ready)
  turns its run `failed` with why, and the agent's other tasks fail for
  10 minutes rather than start it again (`engine/starts/StartHolds`, which
  a message's start keeps to as well, and adds its own failures to; Run
  now is never held, and the agent's engine coming up ends it). A
  switch to ACP mode stops the terminal engine first; that engine's
  statuses are not the start's. An
  ACP start that fails before ready (not installed, a sign-in only ACP
  mode wants, a crash) of a kind that takes a first prompt starts it in
  its own app with the task instead, as before ACP mode: its run stays
  `started`, saying ACP mode did not start and why.
- **An ACP turn that ends badly**: the turn a task began (its first
  prompt, or the prompt) that ends with an error answer, a refusal or a
  limit (`AcpTurnEnds`: `refusal`, `max_tokens`, `max_turn_requests`), or
  whose engine dies mid-turn, turns its run `failed` with why (the turn's
  end comes through `acp/AcpRelay` on the scheduler's thread, after the
  firing that began it). A turn you stop (`cancelled`) leaves the run as
  it was.
- **A run Android cut off**: a run stays `open` from its start until its
  engine is ready (a terminal start) or the ACP turn it began ends. Android
  may close PhoneCanDo meanwhile (the memory killer), and that start or
  turn goes with it. The first `Firing` of a process turns every run still
  open `failed` ("PhoneCanDo was closed before the task finished"; the
  schedule's `lastRun` too while it is its newest) and never runs it again:
  missed runs are never replayed, the agent may have taken the task
  already, and a start that ran the phone out of memory would only do so
  again. The next due time runs as usual. You may bring the agent back
  yourself (Cut-off runs): the run stays `failed`, with "brought back at
  10:42" added to its detail.

## Cut-off runs

`cutoff/` keeps a record of the runs agents have going, and offers back
the ones no stop ended: the phone restarted, PhoneCanDo was updated or
closed by Android, or an engine stopped by itself mid-task. Nothing comes
back without your OK.

- **The record** (`CutOffs`, `CutOffRules`, `CutOffStore`):
  `files/state/cut-off-runs.json` (`{runs: [{agentId, chatId?, title?,
  mode, startedAt, seenAt, checkedAt, life, boot?, scheduleRun?, diedAt?,
  held?}],
  brought: {agentId: [ms]}}`), written whole, atomically and synced to the
  disk (`schedule/StateFile`) only when it changes. `CutOffs` hears the
  engines (`Engines.Listener`): a ready engine's busy chats (ChatBoard:
  working ones, else those waiting for your answer) are its runs, each
  with the chat (a server's session, ACP mode's chat; none for a TUI,
  whose resume args open its last one), how it ran, `life` (a random id
  per process) and the boot count. Every 10 minutes a run still going
  takes its agent's last sign of work (`seenAt`: the supervisor's
  `lastSignAt`, an activity event, TUI output or what ACP mode last sent)
  and when it was looked at (`checkedAt`); a board change alone moves
  neither. `scheduleRun` is the scheduled run open when it began (an ACP
  turn it began), else, for the first run of an engine life, the one that
  started, woke or restarted the agent since that life began (a terminal
  start settles at ready, before its chat moves). Agents a Check now owns
  are left out: its chat is a test, not a run. A stop
  (yours, the idle stop, the memory guard, a cap, a mode switch, a TUI's
  own exit 0) ends the agent's runs as it begins. A stop that keeps them
  marks them `held`: a self-update's `stopAllEngines(true)` and Android
  ending our service with engines up (`onDestroy`, `onTimeout`), each
  through `CutOffs.hold` for the next 15 s. When the installer comes back
  without installing (you cancelled it), `updateCancelled` drops the runs
  the self-update kept, and the agents stay stopped as after any stop. An
  engine that dies on its own keeps them, marked `diedAt`, unless you typed
  into its TUI in the 5 s before (Ctrl+C, `/exit`): that is your quit.
  Engines that are not ready are left alone, so their chats leaving the
  board as they go never ends a run.
- **The look** (`CutOffLook`, once per process: `CutOffBootReceiver` on
  `BOOT_COMPLETED`, which comes after the first unlock, when our
  credential-encrypted files can be read, and `MY_PACKAGE_REPLACED`; the
  module's `OnCreate`, the service's `onCreate`, a notice's tap): runs
  another process saw going were cut off. Why: an engine death, else the
  boot count moved (the phone restarted), else an update (the broadcast,
  or the last exit says so on Android 14+), else Android closed
  PhoneCanDo. When our last exit (`ApplicationExitInfo`, Android 11+) says
  you stopped it (force stop, a swipe that ended it, the task manager),
  nothing is offered, unless a stop kept the runs. Runs of an agent that
  is gone or already runs again, runs not seen for a day, and stale runs
  are dropped. Stale (`CutOffLook.STALE_MS`, an hour): when this process
  last looked, the agent had shown no sign of work for that long, a chat
  left showing working with no run behind it. That last look stands in
  for the cut: a reboot's boot time counts the hours the phone was off,
  and the last exit's time is missing after a reboot and before Android
  11. An engine death, and Android ending our service, are offered at
  once, stale runs left out the same way.
- **The notice** (`CutOffNotice`, id 9470 per agent): "`<agent>`: cut off
  mid-task", why, the chat's title, and Continue (the phone unlocked first)
  or Open, and Dismiss. Dismiss, or a swipe, drops the agent's runs. Any
  start of the agent that is not a bring-back (Home, a schedule, a
  message) settles it: the runs go, the notice too.
- **Continue** (`CutOffActionReceiver` → `CutOffs.bring`) starts the agent
  at once: your tap is what lets Android start our `specialUse` service
  from the background (Android 15 bars only `dataSync` and the like from
  `BOOT_COMPLETED`, but nothing starts at boot here), and that leave lasts
  seconds, so nothing waits in a queue. A second tap while it is on its
  way does nothing. It waits, and the notice says why and keeps Continue,
  while a Check now runs on the agent, its machine installs an agent, or
  another engine starts (one at a time; a bring-back counts for up to 3
  minutes), and with no room (`StartRoom`: memory, your cap; it never
  stops anyone). Your tap is never held back by a recent failed start
  (`engine/starts/StartHolds`); a bring-back that fails records one, so
  other starts of ours hold back. How it goes on (`BringRules`): ACP mode starts in ACP
  mode and reopens its chat (`session/load` or `session/resume`) or fails
  (`StartPrompt.sameChat`), with the note as its first prompt; a TUI that
  starts with a prompt and has resume args resumes its last chat with the
  note (a fallback without the resume args drops the note); a server kind
  that wakes through its server starts, then gets the note posted into
  each chat by name through `inbox.server.wake` once ready (`ServerNote`);
  anything else gets Open. The note (`CutOffText.goOn`) says what cut the
  run off, that what it left running stopped too, and to check where it
  got to and go on without redoing steps. A scheduled run it began as
  stays `failed`, with "brought back at 10:42" in its detail
  (`ScheduleRuns.addNote`). Twice in 6 hours, an agent gets Open only, so
  a run that keeps getting cut off never loops. A start that fails before
  it is ready posts the notice again with why (Open).

## Presence

`presence/` is the agents' presence on the phone: who drives the screen
(the bridge's lease), the hand-over of the controls to you (watch or
paused) and each agent's status line (`agents_status`). `Presence` is the
one entry point; its state is `PresenceStore` (pure, its steps decided by
`HandsRules`; the clock and what a step does outside injected), and the
bridge's routes are `bridge/PresenceRoutes.kt` (`bridge.md` → Hands). The
open bridge attaches its lease and ticks it each second; `Bridge.runEnded`
and an engine gone (`agentGone`) reach it first. A change of the frame
goes to the full build's glass (`Presence.view`), to the app (the
`phonecandoPresence` event) and, for a status, to the service's
notification (an agent's working chat says its status line instead of
"Working", `AgentItems`). Let me is a pause (the agent waits in
`/hands/wait`, the same turn); Stop really stops: the agent is told to end
its turn, and one that calls the screen again has its ACP turn cancelled
(`PresenceStore.pausedCall`). The note that sends it on is `Resume`: a runner notice that wakes it like a scheduled
task (`Mailbox.notice(resume = true)`, `MessagePolicy`'s `resume`), or,
its engine stopped, a bring-back as for a run cut off
(`cutoff/BringKinds`, `BringRules.plan`, in the chat it was in when the
hand-over began). `/notify`'s limits are `NotifyRules` and `/focus` reads
`Focus`. The mascot's figures (`MascotFigures`) live in memory only: JS
pushes them at start and on every change of look. All of it is memory
only: a new process starts with no hand-over and no statuses.

## Checks

What a kind's file says an agent can do is checked against what its
engine lives show (`checks/`). Each capability (kit `Capability`: tools,
messages, wake, task, state, acp, acpTools, acpMessages, chat) reads
**checked**, **unchecked** (not checked yet; still used as set up),
**failed** (not working) or **off** (not declared, kit
`KindCapabilities.declared`; `state` is off too for an agent that keeps no
state of its own). Nothing is guessed: a rule fires on an exact signal or
records nothing.

- **Signals** (`Checks`, each returns at once; `life/LifeWatcher` decides
  on one thread of its own). An engine life runs from a launch (the slot
  adopting its process; a start, or a `ResumeFallback` relaunch, which is
  a life of its own) to its exit, stop or failed start. Before each launch
  spawns, the supervisor empties the inbox folder's `ran/`, so each hook
  reports again. S1: an authenticated bridge request (`BridgeServer`'s
  `onCall`), counted for the life's mode. S2: `@hook\t<Event>[\twait]` in
  the events file (`phonecando-inbox`, once per hook event per life;
  `EventLine.Hook`), read in terminal and ACP mode alike. S3: `@inbox`
  receipts, and the ids of the last wake-marked set `InboxCourier` wrote.
  S4: the supervisor's launch, READY, every engine event, ACP's chat
  opening or `onAcpFailed`, the ACP turn end (`acp/AcpRelay`), an exit
  (code, died, the TUI's screen tail, whether you typed in it), a
  relaunch and a stop; the ones that change the slot are told under its
  lock, so two lives never mix. S5: the TUI's screen (64 KiB of its ring,
  escapes and control bytes stripped, all whitespace removed) holds the
  task's needle, looked at every 2 s inside the task window. S6: the
  agent's own state folder changed after the launch (our seeding and the
  machine note in its instructions file don't count; `life/StateProbe`).
  S7: a server kind's answer to a deliver or wake call (2xx, 4xx, 5xx).
- **Rules** (`rules/CheckRules`, pure, clock injected; the table is its
  header). Successes come from S1 (tools, acpTools), S2/S3 (messages,
  acpMessages, wake), S7, a WORKING event or S5 within 2 minutes of a
  launch with a task, S6 at the first turn end, ACP opening its chat, and
  a terminal launch on ACP's chat that raises an event or stays up 30 s
  after READY. Failures come 10 s (`GRACE_MS`) after a turn end (a
  terminal FINISHED or an ACP `end_turn`) while the life is still up
  (`no_contact` for MCP tools, `no_hook`, `no_waiter`, `empty_state`),
  from a reader's wake-marked set unanswered for a minute and still
  pending (`no_receipt`), S7 4xx/5xx (`http_<status>`), a quit inside the
  task window you didn't type into (`quit_ok`, `quit_error` with the
  screen's last lines), `onAcpFailed` (`acp_failed`) and a relaunch
  without ACP's chat (`chat_refused`). `rules/LevelNow` drops the declared
  messaging level to what works (wakes needs wake or acp, delivered
  messages or acp, inbox tools); `agents_list` and the app show it.
- **Store** (`store/`): one record per kind and capability in
  `files/state/checks.json` (`{version: 1, kinds: {<kindId>: {<capability>:
  {state, key, cliVersion, at, agentId, code, detail, notified}}}}`). The
  newest signal wins; the same finding again only moves on `at`,
  `cliVersion` and `agentId`. A record belongs to its setting (`key`, kit
  `KindCapabilities.key`: the manifest version and a hash of the parts the
  capability rests on), so an edited or updated kind reads unchecked
  again; the CLI version is shown, not matched. A failure whose
  `key|cliVersion|code` differs from `notified` is the first: it gets the
  one notification (`checks/fanout/`). Every record kept goes to
  `Checks.onChange` (a `task` failure fails the scheduled run that
  started it, `schedule/Firing`).

**Check now** (`checks/now/`, the agent page's checks): restarts the agent
with one short test task that asks for no tools ("PhoneCanDo check: reply
with just the word done. Don't use any tools."; tools are checked by their
start-up connection) as its first prompt. While the check runs, each start
of its engine runs it on the check model (`checks/now/model/`) when its
kind takes a model (its `models` block, as for a local model;
`CheckNow.modelFor`, from `EngineSupervisor.start`): a stand-in on loopback
that answers every turn with "done" at once, never a tool call, in
Anthropic Messages, OpenAI Chat Completions or OpenAI Responses. So no
model's speed or answer decides a check, no model loads into RAM and no
account pays for it; a kind with no `models` block asks its own model. The
stand-in stops once no check runs, and an engine on it never outlives its
check: it stops at the end, and with its terminal on screen starts again on
its own model. An agent that ran in its own app before the check starts
again there too, on its own model and its chat from before; one left from
an ACP run stays stopped (`CheckNowRules.restartAfter`), and so does one
you or the memory guard stopped during the check (`stoppedDuring`: a stop
that ended it, or `MemoryStops` since it began). It runs in parts: a kind with an ACP mode
runs it there first in a new chat (testing acp, acpTools, acpMessages, and
state when the agent keeps its own), then (with `engine.prompt` or
`engine.acp.chat`) in its own app on that same chat (tools, messages, wake,
task, chat), with the task again or, without `engine.prompt`, none
(messages and wake skipped, as they need a turn; the part ends 31 s after
ready, once `chat` is judged); any other kind runs one part in its own
app. Only declared capabilities are rows; Check the rest (the default once
anything is checked) leaves out the checked ones and drops a part with
nothing left, except an ACP part whose chat part 2 still tests (it then only
opens that chat and ends once ready), and part 2 with no ACP part before it
takes a new chat. Check all again runs every row. The signals above judge each
part like any other run; each verdict answers its row (`Checks.onChange`
fires for every finding of a life, also one equal to the record kept). A
part ends as soon as all its rows are answered (an ACP part's turn is
cancelled, the next part starts at once), else 11 s after its turn end,
leaving the rest unknown. Any turn end counts there (`LifeEvent.TurnEnded`
says finished, failed or stopped: a terminal FAILED or STOPPED event after
it worked, an ACP error, other stop reason or cancel); only a finished one
feeds the rules, and a failed or stopped one says so in its rows' reason.
A STOPPED the quiet screen guessed (`EngineEvent.guessed`, TuiEvents) never
counts: the run may still work where the screen shows nothing. A tick each second reads its step (starting,
reading the prompt, waiting for your answer, working, waiting for you in
its own app, checking) and whether anything moved (engine state, prompt
tokens read, ACP items, the engine's last output or event, bridge calls and
hook reports; in its own app, its terminal on your screen too). In its own
app, nothing moving for 1 minute while it works is a wait for you, not a
stop: it may be asking you something there (a sign-in, a folder to trust).
The page says so in a dialog with Open `<agent>` (Home, its own app); once
the app is not in front, one notification does the same; any move ends the
wait. While a check runs the service keeps the CPU awake (power/WorkLock),
so it goes on with the screen off. Home shows a bar over the agent while its check runs, back to the
check ("Check done · See results" when it ends there). The run is done after
the last part, failed when an engine ends first, stuck when an ACP part
moved nothing for 3 minutes (not while a question waits) or after 30
minutes in any part, or cancelled (Cancel check stops its engine). A stop
you ask for ends the whole check, its later parts never sent: your Stop on
Home cancels its ACP turn, or its own app reports an interrupt (a turn
end stopped: cancelled, "You stopped its check task"), or the notification's
Stop or the memory guard stops its engine (failed as stopped, even when an
ACP turn failed first as the engine went; `CheckNowRules.turnEndStopsCheck`,
`engineEndStopsCheck`). Done,
stuck or failed, it stops the engine it started unless its terminal is on
screen (on the check model, see above), and with the app not in front one
notification says how it went
(it replaces a wait's; the run's own end alert stays quiet, see
Notifications). Ended or cancelled, it gives the agent back the chat it
was in before the check (`ChatsBefore`: its kept `acpChat` when the check
began, else the ACP part's `chatBefore`) as its `acpChat`, so its next
own-app start opens that chat, not the check's. With neither (no ACP part
and no kept chat, or an agent that cannot list its chats) nothing is
known, and its resume args go back to its newest chat: the check's. While a check runs, an ACP permission question is
rejected at once with no prompt (`acp/AcpRelay` asks `CheckNow.rejects`).

## Agent images (engine side)

Every engine runs in its agent's image, `files/images/<imageId>/`.
`phonecando-linux` creates and fills it (see
`../../../docs/overview/architecture.md` → Linux runtime); this module only
reads the parts an engine needs (`engine/image/ImageDir.kt`, the layout of
`lre/api` `ImageLayout`, read directly so the runner never depends on
`lre/`): `home/` (the engine's HOME: agent config, the agent's database,
projects, keys), `tmp/`, `logs/`, `run/engine.env` and `run/os-note.md`.

The work folder `home/projects/` (`{{projectDir}}`; why not HOME:
`agents/AGENTS.md` → Engine styles) is made by `EngineLauncher.plan` before
each launch, so an image kind's `cd` into it cannot fail. JS reads it as
the agent's `projectDir`: the TUI client's folder picker opens there, and
`phonecando-linux` starts the machine's shell there (`terminal.md`).

Before a start (unless the engine is already ready) JS runs
`prepareAgentImage(agent)` (`src/state/agents.ts`): the image's cheap
per-start refresh (`prepareImageForStart`) with the env names the image
keeps from guests (`guestUnset(agentId)`); a failure there answers
`image_not_ready`.

### Shared machines

Several agents may share one image, like apps on one PC: its system, tools
in `~/.local`, `home/projects/`, VCS and shell config and background
processes. Each keeps its own engine, port, password, bridge token, events
file, inbox folder and engine log. A second agent of a kind on one image gets its own
state folder, `home/.phonecando/agents/<agentId>/` (`AgentFiles`,
`ownState` on its record): the launch adds the kind's `state.env` (kit
`LaunchContext.stateDir`, e.g. `CLAUDE_CONFIG_DIR`), and its config and
instructions file go there (`AgentKind.configDir` / `instructionsFile`).
`deleteAgent` removes that folder, its events file, its inbox folder and
its engine log (and the messages to it, see Messages); an
agent that used its kind's default folders and leaves a machine that stays
takes them with it (`AgentKind.userStatePaths`, never following links).

- **Secrets.** `guestUnset(agentId)` is the union over every agent on the
  image (`GuestEnvPolicy.union`), so `launch.conf` reads the same whoever
  prepares it. An image kind's engine is a guest too and still needs its
  own values among those names (the bridge URL and token, a model key):
  `EngineEnv.carry` passes them as `PHONECANDO_CARRY_<NAME>` and the kit's
  `ImageLaunch` script restores them before `exec`.
- **Who else is here.** `MachineNotes` writes a marked block into each
  agent's instructions file naming the others on its machine and asking it
  to work on its own branch or worktree, leave processes it did not start
  alone and ask before system-wide installs (`MachineNote`). It is rewritten
  for every agent there after `createAgent`, `renameAgent` and
  `deleteAgent`, and on every start; an agent alone gets it removed.
- **Installs.** `recordInstall` sets the version on every agent of that
  kind on the image (one copy on disk). JS runs one install per image at a
  time and stops the co-tenants that use the same files first
  (`src/state/flows/installAgent.ts`).

## Installing an agent

A kind with an `install` block is installed into each of its agents' images
before the agent starts, and only into that image (the order and retries:
`agents/AGENTS.md` → Image kinds). The runner renders
(`agents/install/AgentInstalls.kt` over kit-render); JS runs and records
(`src/state/flows/installAgent.ts`):

- `installPlan(agentId, family)` / `updatePlan` → `{script, timeoutSec,
  phases}`, or null when the kind has no install (or no update): one POSIX
  sh script for the guest's `sh -s`, with HOME the image home (`{{home}}`
  is `$HOME`) and the runtimes' paths first on PATH. It prints
  `@phase <name>` before each of `phases` (`runtime:<id>`, skipped when its
  check passes; `packages`; `install` or `update`; `verify`). `no_recipe`
  when the family (`""`: one we do not know) is not one the kind and each
  runtime install on, or a runtime is missing from this build.
- While it runs, phonecando-linux's job events (`guest/`) come about once
  a second even while it prints nothing: `phase`, `retry` (`{attempt,
  max}` from an `@retry <phase> <n>/<max>` line, until the next phase),
  `elapsedSec`, `downloadedBytes` and `rateBytesPerSec` (the whole app's
  `TrafficStats` receive count; null where Android cannot count) and
  `online` (null when Android won't say). Marker lines stay out of `tail`,
  and a retry starts `tail` afresh, so the screen shows the new try while
  the log keeps the failed one. `ui/env/logic/installText.ts` words them;
  the bar is `state/flows/logic/installProgress.ts` (its header explains
  the model): it never sits at 0 or goes back, and only a run that ended
  well reaches 100%.
- `versionCheck(agentId)` → `{argv, pattern}` or null: `sh -c` with a
  script that puts the runtimes' paths first on PATH and execs the check's
  argv with stderr on stdout (kit-render `ImageLaunch.script`, as an image
  kind's engine starts); `{{home}}` is `/root`. So a `#!/usr/bin/env node`
  program finds node and a version printed on stderr is read.
  phonecando-linux runs it as given and reads stdout.
- `recordInstall(agentId, output)` → `{version}`: group 1 of the pattern
  becomes the agent's `installedVersion` (`verify_failed` when it matches
  nothing; a kind without a check records `installed`).
- `startEngine` refuses `agent_not_installed` while the kind has an
  install and the agent has no `installedVersion` (`InstallGate`).
- `guestUnset(agentId)` (kit-render `GuestEnvPolicy`): a native kind's
  bridge URL and token and every env value it fills with a secret; an
  image kind's own engine is the guest and keeps them (lre unsets `LD_*`
  on top). On a shared image it is the union over every agent there (see
  Shared machines).

## Agent config seeding

Each kind's config source lives in its folder under `agents/` (opencode:
`agents/native/opencode/config/`, plus `config-lite/` for the non-full
channels), described by the `config` block of its `agent.json`.
Kind-neutral code lives in `agents/shared/` (the phone tools,
`agents/shared/phone-tools/`, packaged per its `part.json`) and is packaged
inside each kind's config (`agents/opencode/config/phone-tools/`), so a
kind's plugins import it by a relative path; the full-only `control/` part
is dropped outside full. `agents.gradle`'s `syncAgentConfig<Variant>` task
packages each kind whose `channels` include the flavor into generated
Android assets at `agents/<id>/` (`agent.json` and `config/`).
`ConfigSeeder` writes it to the kind's config dir (`AgentKind.configDir`:
under the image HOME, or in the agent's own state folder) on every engine
start (opencode: `home/.config/opencode/`): plugins, the phone
tools, skills and `AGENTS.md` refresh, `opencode.json` is seeded only when
absent so edits and BYOK keys survive. A manifest of the seeded files
(`.phonecando-seeded`) lets the next start delete files we no longer ship,
so a renamed plugin never loads twice; user files are never touched. Then
the image's `run/os-note.md` (OS, package manager, no systemd) is written
between two marker lines in the kind's instructions file (the manifest's
`instructions`, `AgentKind.instructionsFile`; opencode: the global
`AGENTS.md`), replaced where it is on every start (`OsNote`, over the
shared `MarkedBlock`), and the machine-mates note after it (see Shared
machines). Before it goes the note on PhoneCanDo (`PhoneCanDoNote`, its own
marked block): what PhoneCanDo is, that the agent runs inside it on a
phone (short replies, limited memory, the idle stop, `~/projects`, what the
user can do in the app), its machine (Linux, read from `PHONECANDO_IMAGE` in
`engine.env`, or Android) and, for a kind with the phone tools, the
phone-control rules on full (the basic tools on lite and play) and how to
talk to the other agents. Its parts are `agents/shared/phonecando-note/*.md`
(packaged by `agents.gradle`, `phone-control.md` on full only), with the
agent's name and kind filled in, so every kind with an instructions file
gets the same text; opencode's own `AGENTS.md` is only a header. A failed
seed never blocks a start.

## Build channels

`full`, `lite` and `play` (what each ships, permissions, tool gating):
`bridge.md` → Build channels. `./manage build lite|full` builds a signed
APK and audits it; `./manage release <version>` builds both and drafts the
GitHub release (`../../../docs/release/android.md`).

## Self-update download

The update's Download step runs natively (`update/`, `api/UpdateFunctions.kt`),
so it goes on while the user keeps working and with no JS around.
`startUpdateDownload(spec)` takes latest.json's APK (`url`, `name`, `size`,
`sha256`, `versionCode`, `version`), refuses anything but one of our GitHub
release assets with a plain `.apk` name, and downloads it into
`files/updates/<name>` through `<name>.part` beside it, on network's
`FileDownloader` under its `RetryLoop`: a dropped connection resumes with
`Range`, no network waits for one, and the file becomes the APK only once
its size and sha256 match. One download at a time: starting another spec
stops the old one and deletes its files. While it runs our jobs anchor
keeps the foreground service up and the CPU awake, with a "PhoneCanDo
update · downloading 45%" line in its notification. The spec and its step
are kept in `files/state/update-download.json`, the name on
`files/state/update-downloads-to-resume.txt`, so a process death, or a
network that stayed down, resumes it once on the next start (`JobsAnchor.install`
→ `UpdateDownloads.recoverOnce`). `updateDownloadState()` reads where it is
(`done` only while the finished APK is there whole), every change is the
`phonecandoUpdateDownload` event, and `stopUpdateDownload()` drops all of
it: the job, its `.part` or finished APK, the record and the resume entry.
After an install, at each process start and in `PackageReplacedReceiver`,
the record and everything in `files/updates/` go once the installed build's
`versionCode` is the recorded one or newer (also the old JS downloader's
APKs: with no record nothing there is ours). A failed cleanup never blocks
anything.

## Self-update install

An update takes two taps (`src/state/flows/update/`): Download, which
stops nothing, then Install. Install first checks Android's "Install
unknown apps" switch for PhoneCanDo (`canRequestPackageInstalls()`); when
it is off, the update box explains it and opens that settings page itself,
then installs once the user comes back with it on, instead of Android's own
prompt landing on top of the box. Then `stopForInstall` in
`src/engine/updates/install.ts` stops every engine (`stopAllEngines(true)`:
the runs they have going are kept for the new build's cut-off notices),
and `openInstaller` hands the APK to Android's installer screen with
`ACTION_VIEW`. Back without an install, `updateCancelled()` offers those
runs at once (cut-off notices, `Why.INSTALL`, Continue goes on in the same
chat) and resolves with their agents; the app starts the other agents it
stopped again (a start of its own would settle an offer).
Play Protect allows lite installing full because the originating app is
PhoneCanDo, not a browser (`docs/release/upgrade-test.md`).

After that install, Android 13+ keeps the accessibility toggle locked until
App info → ⋮ → Allow restricted settings, and that menu item only appears
after Android has shown its "Restricted setting" notice for the app. The
app cannot read the lock, and Android 14+ lets us show that notice in place
(`android.settings.SHOW_RESTRICTED_SETTING_DIALOG`); the AOSP details are
in `research/restricted-settings.md`. So `RESTRICTED_FLOW` (`true`, in
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
(`stopAllEngines(true)`, which resolves once no engine and no tagged
process is left and keeps the runs going for the new build to offer back,
see Cut-off runs; then polls `isAnyEngineAlive` for up to 4 s) and calls
`markSelfUpdatePending()`, which stores a timestamp and the running build's
channel in the runner prefs (`phonecando-engine`; `commit`, since the
install kills the process).
`PackageReplacedReceiver` (`MY_PACKAGE_REPLACED`, runs in the new build)
acts only when that mark exists and is under 30 minutes old, and always
clears it, so dev reinstalls, `adb install` and Play updates stay quiet. It
never acts on the play channel, and it stays quiet when the user is already
back in the app through the installer's Open button. Acting means a
"PhoneCanDo updated" notification ("switch on phone control" only for lite
→ full) and a launch attempt that Android 10+ usually blocks from the
background. The module's `OnCreate` cancels that notification on every app
start; each way back after an update cold-starts the new build.

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
  on; no reset or consume clears it). Off drops the engine stderr tail when
  sharing turns off and keeps none while it stays off, so a report sent
  after turning it back on never carries output from the off period.
  Counters and crash capture go on, local only (the app drops what it
  consumes while off).
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
  a relaunch after another engine answered on the port. `lastBootMs` runs
  from the module's `startEngine` call to the first 200 of the kind's
  health probe (`EngineWatch.kt`). An exit without a stop request counts
  `died` and keeps the exit code, the time it was noticed (`lastDiedAt`)
  and, while sharing is on, the last ≤2 KB of that agent's
  `<image>/logs/engine-<agentId>.log` (an exit that left none clears the
  old tail).
  The tail reads at most the last 16 KB, redacts all of it, drops the
  cut-off start (the first line, or in a line longer than 16 KB its first
  token and, after a possible credential label, the next), then keeps the
  last 2 KB on a UTF-8 boundary. It can hold prompt text, so the app sends
  it only in a user-initiated report.
- Redaction (`PathRedactor.kt`, pure; its header has the rules, matching
  `tce/core/redact.ts` and `docs/telemetry.md`; JVM tests:
  `./gradlew :phonecando-runner:testLiteDebugUnitTest`): a whole path
  becomes `<path>` (a stack frame's `:line[:col]` stays), and every
  agent's engine password (in every form its kind knows) and bridge token,
  the model servers' keys, auth header values and common provider key
  shapes become `<secret>`. One engine's log or a crash can carry another
  agent's secrets, so all of them are replaced.
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
  Android 14+ delivers none of these, so the counter stays 0 there (the
  memory guard polls instead).
- Live fields (`TelemetrySnapshot.kt`, read on every call):
  `installSource` (installer package), `batteryOptIgnored`,
  `fgServiceRunning` (true while any agent's engine is starting, ready or
  stopping), `a11yConnected` (the `isUiAutomationConnected` check, false in
  lite/play) and `drmIdHash`, null while `TELEMETRY_DRM_ID_ENABLED` is false
  (MediaDrm is then never touched).

## Not implemented yet

- Battery-exemption prompt, and restarting an engine that died by itself
  when it was not mid-task (the next start relaunches it; one that was
  offers Continue, see Cut-off runs).

These are tracked in `../../../docs/planning/automation.md`.
