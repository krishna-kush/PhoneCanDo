# phonecando-runner (engine host)

`phonecando-runner` (`com.phonecando.runner`) is the Expo module that hosts
the agents' engines: the agent records, the engine supervisor and its
foreground service, the memory guard and the user's run limits, the
loopback bridge (`bridge.md`), agent installs, the local model servers and
the config it seeds into each engine's HOME.

## Native API

- `api/AgentFunctions.kt`: `listAgents`, `createAgent({kind, name,
  imageId})`, `renameAgent`, `deleteAgent` (stops the agent's engine first;
  the image stays, and JS deletes it through `phonecando-linux`). The record
  JS sees is `src/engine/agents/records.ts`.
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
- `api/EngineFunctions.kt`: `startEngine(agentId)`, `stopEngine`,
  `stopAllEngines`, `isAnyEngineAlive`, `touchEngine`, `engineStatus`,
  `engineStatuses`, `isEngineIdle` (the kind's idle rule) and
  `engineHealth` (`ok|starting|http-N|error:…`, one probe; a TUI engine
  answers by its state). Every change is the `phonecandoEngineState` event
  (`EngineStatus`). `startEngine` resolves `{port}` (null for a TUI engine)
  once the process runs; an engine already starting or ready resolves at
  once. It rejects with an `EngineStartError` code (`records.ts`).
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
- `PhoneCanDoRunnerModule.kt`: `getPrefix`, `getBuildChannel`, the
  phone-control switch, the `phonecandoLaunchTarget` event, the bridge
  prompts (`pendingPrompts`, `resolveUnlock`, `resolveAccessibility`, event
  `phonecandoBridgePrompt`; see `bridge.md`), the accessibility guide calls,
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
  finds and ends an agent's processes, `engine/spawn/` starts an engine by
  its style, `engine/ready/` says when it is ready, `engine/tui/` is a TUI
  engine's terminal and viewers.
- `models/`: the local model servers (see Local model servers).
- `memory/`: the memory guard (see Memory guard); `limits/`: the user's
  run limits (see Run limits).
- `notify/` and `prompts/`: the agents' notifications, alerts and links to
  open, and where a tap opens the app (see Notifications).
- `PhoneCanDoServeService.kt`: the foreground service (`dataSync` type).
- `PackageReplacedReceiver.kt`: brings the app back after a self-update
  (see Self-update install).
- `AndroidManifest.xml`: service, receiver and `OpenTargetActivity`
  declarations plus `FOREGROUND_SERVICE*` permissions (merged at build).

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
then on a launch adds the kind's resume args (`engine.resume`).

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

Its payload (`liboc-engine.so`, `liboc-opentui.so`) ships as `jniLibs`
(`extractNativeLibs=true`) and runs directly: INTERP is the OS linker,
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
  `PHONECANDO_EVENTS` (see TUI engines), `PHONECANDO_CHANNEL` and, last,
  `PHONECANDO_AGENT=<agentId>`. A server engine runs from the
  native-library dir in its `launch.cwd` (HOME when it names none); its
  stdout and stderr go to `<image>/logs/engine.log`.
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
  without a viewer.
- **Events file** (`engine/events/`): every start of a TUI engine seeds
  the kit's two scripts (`agents/kit/scripts/`) into
  `<home>/.phonecando/bin/` (mode 755, replaced whole) and empties
  `<home>/.phonecando/events`, whose path the engine gets as
  `PHONECANDO_EVENTS` (`/root/…` for an image kind). An image kind also
  gets `BROWSER` = that `phonecando-open` unless its env sets one.
  `phonecando-event <name> [message]` appends
  `<name>\t<session>\t<message>`, `phonecando-open <url>` appends
  `@open\t<url>`; a line over 4 KiB is dropped whole. While the engine is
  ready, `EventFileTail` reads new whole lines every 500 ms (one thread for
  all engines; a file that got shorter is read from its start).
  `EventSink` maps a name through `events[].hook.map` to an engine event;
  an unmapped name does nothing. An `@open` line becomes an `open_url`
  prompt (see Notifications).
- **Idle**: `idle.from: ["output"]` makes PTY output the activity: no
  output for `quietSec` is idle, and output marks the engine used.
- **Resume**: a launch with `engine.resume.args` that exits other than 0
  before it is ready, or once ready but before it raised any event
  (first-run screens made it ready), may have had nothing to resume
  (`claude --continue` in a folder without a chat), so it is launched once
  more without them, as the same start (`ResumeFallback`: one start, no
  death).
- **Stale runs**: hooks may never say a run ended (Claude Code's Esc fires
  none), so for a kind with `events[].hook` a run left `working` that has
  shown nothing for 30 s ends as stopped and leaves the chat board.

JS starts engines through `src/engine/ensureEngine.ts` (one start in flight
per agent; a ready engine is only marked used) and waits for a fresh start
with `waitForEngine` (`src/engine/connection.ts`). It never talks to an
engine itself: the web UI's sign-in URL and the TUI's recipe come from this
module (`pairWebUi`, `clientRecipe`).

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
  random key per start in `LLAMA_API_KEY` (never the argv), one slot, the
  context lme-host plans (`models.md` → Context; the kind's
  `{{contextWindow}}` is what the server got) and `--cache-ram` from what
  that leaves. The plan goes to logcat (`PhoneCanDoModels`); a plan past
  the RAM budget is logged, never refused. It tells `ModelsHost` what each
  serves, so each model's card shows its server's own context. The start
  waits for `/health` (up to 5 min), so the agent stays `starting` while
  its model loads, and the service's start thread waits with it. Each
  server's output goes to `files/logs/model-server-<model id>.log`; its
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
  server (SIGTERM, SIGKILL after 3 s). `stopModel` stops its agents first,
  then the server, also while it loads. A server that exits by itself
  takes its agents down (`died`, `model_unavailable`): their engines had
  its URL and key.
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
  `n_prompt_tokens_processed` (it grows once per 2048-token batch) and
  `cached` is `n_prompt_tokens_cache`. /slots gives no total for the
  prompt, so none is shown. Each change goes to the app (the event) and to
  the service notification (`notify/ReadingLines.kt`).

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
- **Who goes.** Never the agent on screen while the app is in front (the
  one `setOpenChat` names); agents with no run going (their kind's idle
  rule) first, least recently used first, then working ones the same way.
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

## Foreground service and lifetime

`PhoneCanDoServeService` anchors the engines while the app is in the
background, and the process while a model download or import runs. It runs
the start requests, holds for model jobs (`ACTION_HOLD` from
`models/ModelJobsAnchor.kt` when the first one begins; `models.md` →
Jobs), shows one notification that lists the chats the agents are busy
with, the model server reading a prompt and the model jobs with their
share done (`notify/ServiceNotification.kt`, `ReadingLines.kt`,
`TransferLines.kt`, channel `phonecando-engine`; see Notifications) and
stops itself once neither an engine nor a model job runs. Every command
answers `START_NOT_STICKY` and a null-intent restart starts nothing.

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
every two minutes), each bridge call and each engine event mark an engine
used, so it is not the one stopped to make room (under the user's cap) or
to free memory (the memory guard).

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
9300-9363. The engine service (4101), the update notice (4202) and the
memory guard's notice (4301, on the agents' channel; see Memory guard) are
untagged.

- **Where a tap lands.** A `LaunchTarget` names a place (`home`, `env` or
  `settings`: Home, the agent's page or the systems list, Settings; an open
  terminal stays on top of any) plus, when the reason is one agent, that
  agent. Every agent notification's tap, the
  single-agent engine notification and the bridge's own launch start
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
- **The service notification lists chats, not engines.** One line per
  chat: its title, then its agent, then its state ("Working", "Waiting for
  your answer", "Stopped with an error", "Done"), waiting first and newest
  first within a state; collapsed, the counts ("1 waiting for your answer ·
  2 working"), and only the counts on the lock screen (public version).
  With no chat, "No chats running". `notify/ChatBoard.kt` (pure) keeps the
  board from the same events as the alerts: a top-level session shows from
  its first activity; done and error stay until the user opens that
  agent's chat (`dismissAgentAlert`) or its engine stops or dies, at most
  four of them; a run the user stops (`STOPPED`: opencode
  `session.execution.interrupted`) or a deleted session leaves; a
  subagent's child session shows only while it waits for an answer. The
  chat on screen is left out: the app reports it (`setOpenChat`, from
  `useOpenChat.ts`: the web UI on a chat, Home with nothing over it,
  app in the foreground; null otherwise), a run that ends while it is open
  counts as seen, and opening a done or error chat sees it. An agent TUI in
  front reports its chat by the title it gives the terminal
  (`ui/terminal/useOpenTuiChat.ts`, the kind's `chatTitle`: opencode
  writes `OC | <title>`, cut to 37 characters and "…" past 40); the board
  hides it only when exactly one of that agent's chats fits, so a fresh
  untitled chat or two with the same title stay listed; a title that fits
  none makes the tracker read that agent's titles again.
  `notify/ChatTracker.kt` reads titles from the engine (the manifest's
  `chats.title`: opencode `GET /api/session/{id}`, `/data/title`; the
  stream carries a title only on create and rename) when a chat first
  shows, starts a new run and finishes, one loopback GET at a time on its
  own thread; a rename (opencode `session.renamed`, often after the first
  run has ended) updates it straight from the stream; a chat without one
  yet reads "New chat". The service re-renders only when the board changes
  (`Engines.Listener.onChats`), never per token. A tap opens the app, on
  that agent's Home when every listed chat is one agent's.
- **Agent alerts.** `EngineStreams` passes every engine event to
  `notify/AgentAlerts.kt`; `notify/AlertRules.kt` (pure) decides. A
  top-level session's verdict (`FINISHED`, `FAILED`) and any session
  waiting on the user (`WAITING`: opencode `permission.asked`,
  `form.created`) alert; a subagent's child session (its `session.created`
  has a parent) never alerts on its verdict; an interrupted run
  (`STOPPED`) never alerts; the same alert for the same session comes once
  until that session moves again. Nothing posts while PhoneCanDo is in
  front (an activity on screen). The alert goes in the agent's slot,
  titled with its name: "Finished. Tap to see the result.", "Stopped with
  an error. Tap to see what happened." or "Waiting for your answer."; a new
  one replaces the last and makes no sound while the last is still
  showing. A tap opens the agent's Home; showing that agent's chat takes it
  down (`dismissAgentAlert`, from `useEngineTouch`: a call of its own,
  since `touchEngine` also runs for engine starts that show nothing). A new
  engine life starts with fresh rules for the agent; deleting an agent
  takes down all its notifications.
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
packages each kind whose `channels` include the flavor into generated
Android assets at `agents/<id>/` (`agent.json` and `config/`).
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
Android's installer screen with `ACTION_VIEW`. The update dialog first
checks Android's "Install unknown apps" switch for PhoneCanDo
(`canRequestPackageInstalls()`); when it is off, the dialog explains it and
opens that settings page itself, then installs once the user comes back
with it on, instead of Android's own prompt landing on top of the dialog.
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
(`stopAllEngines`, which resolves once no engine and no tagged process is
left, then polls `isAnyEngineAlive` for up to 4 s) and calls
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
  `<image>/logs/engine.log` (an exit that left none clears the old tail).
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

- Boot receiver (note: Android 15+ forbids dataSync FGS from BOOT_COMPLETED).
- Battery-exemption prompt, and restarting an engine that died by itself
  (the next start relaunches it).

These are tracked in `../../../docs/planning/automation.md`.
