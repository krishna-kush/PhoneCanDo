# cline

The Cline CLI, installed from npm on our `node` runtime and run as a TUI
in the agent's machine, through our launch script `config/launch.sh` and
with one Cline plugin of ours, `config/phonecando.js`. Shared image-kind
rules: `agents/AGENTS.md` §4.

Sources below are the cline repo at tag `cli-v3.0.74` (npm `cline`
3.0.74, the latest on 2026-11-19; main's CHANGELOG also ends at 3.0.74).
Paths are relative to that repo.

## Install

`cline` is a small Node launcher for Cline's Bun-built binary,
`@cline/cli-linux-arm64`, which npm installs beside it. That binary is
glibc-only, so no Alpine.

## Launch

`sh /root/.phonecando/cline/launch.sh [args]`, for the TUI and for ACP
mode (`--acp`). It sets things up, then `exec cline "$@"`
(`/root/.local/bin` first on PATH):

- Cline's folder is `$CLINE_DIR` (a second Cline agent's own, State),
  else `~/.cline`.
- `CLINE_HUB_DISCOVERY_PATH` is `<folder>/data/locks/hub/phonecando.json`
  (The hub).
- It copies our plugin into `<folder>/plugins/phonecando.js` (The plugin).
- `--acp`: the provider for ACP mode (ACP mode).
- `--phonecando-continue` becomes `--id <id>` (below).

Then:

- `resume` adds `--phonecando-continue`. Cline has no `--continue` and no
  "latest" (`-c` is `--cwd`; `apps/cli/src/commands/program.ts:37,47`),
  only `--id <session-id>`, which opens the TUI on that chat
  (`apps/cli/src/main.ts:728-746`). The script takes the newest row of
  `cline history --json --limit 200` whose `cwd` is this folder, by
  `updatedAt` (rows: `sdk/packages/shared/src/session/records.ts:26-55`;
  `history` filters by no folder, `apps/cli/src/session/session.ts:103-116`),
  under `timeout 30` when there is one. With none it adds nothing. A
  launch that also has a prompt (`-- <prompt>`: a run cut off brought
  back, a note to go on after a hand-over) keeps that chat too: `--id`
  drops a prompt (`main.ts:741-746`), so the script hands it to our plugin
  in `<folder>/phonecando-prompt.json` with the time, and the plugin's
  `setup` sends it into the reopened chat (`queue_message`) and deletes
  it; one older than two minutes is dropped, so it never runs in a later
  session. With no chat to go back to, the prompt starts a new chat as
  usual. Not checked: that `setup` runs for an `--id` session before you
  type (if it doesn't, the chat opens and the prompt is lost; you go on
  yourself). A chat that won't open exits non-zero and
  the runner starts it again without the resume args (`ResumeFallback`).
  It costs one more `cline` start before the TUI.
- `prompt` (a scheduled task) appends `--tui -- <task>`: the TUI with the
  task as its first prompt, submitted once sign-in is done
  (`apps/cli/src/tui/root.tsx:956-967`; with `--tui` the quoted-prompt
  check is skipped, `main.ts:785-791`). Never without `--tui`: a bare
  `cline <prompt>` runs it once, in yolo mode, and exits. Not checked: a
  one-word task that is also a subcommand's name (`update`, `history`)
  may run that subcommand, as commander dispatches on the first operand.
- The window title is `Cline`, then `> <first line of the latest prompt>`,
  cut to 80 characters (`apps/cli/src/tui/utils/terminal-title.ts:4-54`);
  `surfaces.chatTitle` takes the prompt. A message from another agent
  that wakes it is a prompt too, so it retitles the chat.
- `CLINE_NO_AUTO_UPDATE=1`: "Update agent" runs `update.steps`.

## The plugin

Cline loads every `*.js`/`*.ts` file in `<folder>/plugins`,
`~/Documents/Cline/Plugins` and the workspace's `.cline/plugins` into each
session, TUI, hub and ACP alike, and runs it in a worker thread with the
host's env (`sdk/packages/shared/src/storage/paths.ts:618-626`;
`sdk/packages/core/src/extensions/plugin/plugin-config-loader.ts:297-302`;
`sdk/packages/core/src/runtime/tools/worker-sandbox.ts:274`). Its docs
send hooks there too (`docs/customization/hooks.mdx`: "See details under
SDK Plugins"). A plugin's hooks are `beforeRun`, `afterRun`,
`beforeTool`, `afterTool` (`docs/sdk/plugins.mdx:66, 191-201`), each with
a 3 s budget (`plugin-sandbox.ts:480`); one that keeps failing is turned
off for the hub's life (`docs/customization/plugins.mdx:159`).

- The copy: when `phonecando.js` is missing there, or is a plain file
  still holding our first line (`phonecando-managed: cline plugin`) and
  differs from ours. Never over a file of yours, a link or a folder;
  delete that line and the file is yours. A copy, not a link: Cline's scan
  skips links (`paths.ts:821-866`, `Dirent.isFile()`). It is written
  aside as `phonecando.js.phonecando-<pid>` (not a `.js` name, so never
  loaded half-written) and renamed in.
- It does nothing unless the engine has our variables
  (`PHONECANDO_BRIDGE_URL`, `PHONECANDO_EVENTS` or `PHONECANDO_INBOX`):
  with none it is a bare plugin with no hooks, so a `cline` you run in the
  terminal is untouched.
- `CLINE_PLUGIN_IDLE_TIMEOUT_MS=2147483647`: Cline ends a plugin worker
  after 30 minutes with no calls (`plugin-sandbox.ts:37, 413-445,
  457-461`), which would stop our wake timer in an idle chat. It holds for
  your plugins' workers too.
- Sub-agents' runs (`snapshot.parentAgentId`,
  `sdk/packages/shared/src/agent.ts:154-160`) raise no events and take no
  messages; our tools stay trusted in them.
- `test/plugin.test.mjs` runs its hooks against an inbox folder laid out
  as the runner lays it out.

## State

- No single global instructions file (its rules are a folder of files).
- A second Cline agent on the machine keeps its state in its own folder:
  `CLINE_DIR` (same as `--config`) replaces `~/.cline` as a whole: sign-in
  (`data/settings/providers.json`), chats, settings, hooks, plugins and
  the hub's discovery file (`paths.ts:158-167, 186-192, 431-453`;
  `docs/getting-started/config.mdx:98,112`). Sign-in is that file, mode
  0600 (`sdk/packages/core/src/services/storage/provider-settings-manager.ts:198-209`);
  Cline uses no keychain.
- Shared by the machine's Cline agents: `~/Documents/Cline` (rules, hooks,
  plugins), our `~/.phonecando/cline` with its MCP settings file (Phone
  tools), and the hub's port.
- `userState`: `~/.cline`.

### The hub

The TUI runs a chat in Cline's hub daemon when one is up (it forces
`backendMode: "auto"`, `apps/cli/src/runtime/interactive/session-runtime.ts`),
and the hub, started with its starter's whole env, spawns the MCP servers
and loads the plugins. Every `cline` finds the hub through one discovery
file, `<folder>/data/locks/hub/production.json` by default
(`sdk/packages/core/src/hub/discovery/workspace.ts:38-43`), so a hub
started by a `cline` you run in the terminal would run this agent's chats
without our variables, and ours would run your chats with this agent's.
The launch sets `CLINE_HUB_DISCOVERY_PATH` to
`<folder>/data/locks/hub/phonecando.json`, so each finds only its own hub
(the hub's instance lock follows that path too), and a second agent's
follows its own folder.

The port stays 25463: a fixed `CLINE_HUB_PORT` could meet another
machine's Cline agent on the phone's shared loopback, and no template
gives a TUI kind a port of its own. Whichever starts its hub first has the
port. The other finds a hub there with no discovery record of its own and
no way to its token (`/health` gives none), so its prewarm fails quietly
and its chats run in its own process, with its own env
(`sdk/packages/core/src/hub/daemon/index.ts` `ensureDetachedHubServerLocked`,
`runtime/host/host.ts`): it has no hub, but never shares one. The runner
reaps a hub with its engine. Read from source; owed: a phone check.

## ACP mode

`cline --acp` (the ACP registry's `cline` entry), run as
`launch.sh --acp`.

- `initialize` offers `loadSession: true` and nothing else: no
  `sessionCapabilities.list`, no resume (`apps/cli/src/acp/acpAgent.ts:128-150`).
  `session/load` replays the chat (`acpAgent.ts:249-326`).
- Provider: ACP mode never reads the provider and model in
  `providers.json` (what its TUI uses): a new or reloaded session takes
  `CLINE_PROVIDER`, else `cline`, and the provider's default model
  (`acpAgent.ts` `newSession`, `loadSession`, `resolveDefaultModelId`).
  With the default, a free account's scheduled task failed on the phone
  ("Insufficient balance", `anthropic/claude-sonnet-5.5`, 2026-11-17). So
  the script reads `lastUsedProvider` from `<folder>/data/settings/providers.json`
  with node and exports it as `CLINE_PROVIDER` (only when unset and a
  plain id).
- Model, through the code hook `cline.model` (`optionsHook`,
  `kotlin/.../ChosenModel.kt`): when a chat opens, the runner reads that
  provider's `settings.model` from `~/.cline` in the machine's HOME (only
  those two fields; the file also holds sign-in tokens) and sets it as the
  `model` config option. Not `CLINE_MODEL`: Cline takes it only when its
  chat-model list (`Llms.getModelsForProvider(provider, {filter:
  "chat"})`) has it, and that list leaves out the free `cline-free/*`
  models (phone, 2026-11-17). Its `setSessionConfigOption` takes any
  `model` value as it is (`acpAgent.ts`, `case "model"`). The hook is
  given HOME only (kit `KindHooks.acpOptions`), so a second Cline agent's
  ACP chats get the first one's model.
- `env` `CLINE_SESSION_BACKEND_MODE=local`: ACP mode honours it (the TUI
  forces `auto`), so an ACP chat runs in the `cline --acp` process with
  its env, never in a hub, and starts none
  (`sdk/packages/core/src/runtime/host/host.ts` `createRuntimeHost`).
- `tools: config`: `cline --acp` keeps the `mcpServers` of session/new but
  never uses them (`acpAgent.ts` stores them and reads them nowhere; open
  PR #15740 would wire them). It loads the servers in its settings file as
  the TUI does, so it gets the phone tools from ours (Phone tools), and
  the plugin as the TUI does.
- Permissions: one question per tool call, titled
  `<server>__<tool>` or `<server>__<tool>: <input, cut to 60>`
  (`phonecando__agents_send: to="…"`), kind `other`
  (`apps/cli/src/acp/tool-utils.ts:38-42`, `apps/cli/src/utils/helpers.ts:168-333`).
  Its only auto-approve is the `auto_approve` option for every tool at
  once, off by default (`apps/cli/src/acp/auto-approve.ts`,
  `acpAgent.ts:703-710, 791-792`), and "Allow always" counts once
  (`apps/cli/src/acp/permissions.ts:74-78`). Our plugin's trust (Phone
  tools) is what keeps phone tools from asking here.
- `chat`: `--tui --id <session-id>` opens that session in the TUI and
  waits for input, with no prompt (phone, 2026-11-17). An ACP chat's id is
  one of Cline's own sessions (e.g. `1794913202337_tiqRE_cli`, `source:
  cli`), so after an ACP run, or a tap on a scheduled run, the terminal
  opens that chat.
- PC trial (2026-11-13): the handshake only; a chat needs sign-in. Owed:
  a signed-in turn on the phone.

## Events

The plugin, through `phonecando-event` (spawned, never waited on):

- `beforeRun` raises `RunStart` (working).
- `beforeTool` on `ask_question` or `ask_followup_question` raises
  `AskUser` (waiting); its `afterTool` raises `AskDone` (working).
- `afterRun` raises `RunDone` (finished), `RunFailed` (failed) for a run
  that failed or ended with an error, or `RunStopped` (stopped) for one
  you aborted (`result.status`, `sdk/packages/shared/src/agent.ts:147-152,
  490-492`).
- Nothing tells us when Cline's own approval dialog waits on you: no hook,
  plugin event, bell or title change goes with it
  (`apps/cli/src/runtime/interactive/approvals.ts:39-52`,
  `apps/cli/src/tui/components/dialogs/tool-approval.tsx:143-149`). The
  TUI approves every tool unless you turn that off (`--auto-approve`
  defaults to true, `main.ts:884-895`).
- Cline's hook files (`TaskStart.sh` and the like) are not used: they run
  only from `<folder>/hooks`, `~/Documents/Cline/Hooks` and the
  workspace's `.clinerules/hooks` and `.cline/hooks` (`paths.ts:495-509`),
  named after the event, so ours could replace one of yours.
  `--hooks-dir` sets `CLINE_HOOKS_DIR` (`main.ts:782-784`), which nothing
  reads (open PRs #15608, #15126). Their start, prompt and end events are
  fire-and-forget (`sdk/packages/core/src/hooks/hook-file-hooks.ts:776-990`).

## Phone tools

`mcp:config`, through a stdio server of ours, since Cline can't name the
bridge itself:

- It expands no variables in its MCP settings, and a remote server's `url`
  must be a URL, so `${PHONECANDO_BRIDGE_URL}/mcp` would reject the whole
  file and the token would have to be written to disk
  (`sdk/packages/core/src/extensions/mcp/config-loader.ts`). A plugin's
  `registerMcpServer` is no way round it: it reaches the runtime only
  through `cline plugin install`, which writes the resolved values into
  the settings file (`sdk/packages/core/src/services/plugin-mcp-settings.ts:265`).
- No flag adds an MCP file. `CLINE_MCP_SETTINGS_PATH` replaces the one it
  reads (`<folder>/data/settings/cline_mcp_settings.json`, `paths.ts:447-453`),
  and Cline writes there too: `cline mcp add`, a server turned off, OAuth
  state, a `<file>.lock` folder and temp files beside it.

So the launch sets `CLINE_MCP_SETTINGS_PATH` to our
`cline_mcp_settings.json` in `~/.phonecando/cline` (ACP mode inherits it).
It is seeded once (`config.keep`: only while it is missing, and never
pruned) and then the agents': servers you add there stay, for every Cline
agent on the machine, and a later change of ours to it reaches only a
machine without one (delete it, and the next start brings ours back).
This agent doesn't read the servers in Cline's own settings file. To add
one from the machine's terminal:
`CLINE_MCP_SETTINGS_PATH=~/.phonecando/cline/cline_mcp_settings.json cline mcp add ...`.

Its one server, `phonecando`, runs `node phonecando-mcp.mjs`, seeded on
every start:

- It reads newline JSON-RPC on stdin, POSTs each message to
  `<bridge>/mcp` with the agent's token and writes each answer back as
  one line (an SSE answer's messages one line each; a 202 none). Lines are
  handled at once, so `agents_wait` holds nothing up. A failed request
  gets a JSON-RPC error with its id.
- The token: Cline starts a stdio server with its own env plus the
  entry's `env`, unexpanded (`extensions/mcp/client.ts` `spawnProcess`),
  so the entry never names `PHONECANDO_BRIDGE_TOKEN` (the literal would
  replace the real one) and the script reads the inherited
  `PHONECANDO_BRIDGE_URL` and `PHONECANDO_BRIDGE_TOKEN`. The entry's
  `PHONECANDO_MCP_URL` and `PHONECANDO_MCP_TOKEN` are
  `${env:PHONECANDO_BRIDGE_*}`: open PR #12865 would expand that form and
  pass a stdio server only the MCP SDK's default env, and then the script
  takes those (it skips a value that still starts with `${`).
- It refuses a bridge that isn't `http://` on loopback and never uses an
  HTTP proxy: its own `http.Agent` reads no proxy env, where
  `NODE_USE_ENV_PROXY` sends Node's `fetch` through one even to
  127.0.0.1. Nothing it writes (answers, or stderr, which Cline quotes in
  its errors) holds the token.
- `timeout: 300` (Cline's default is 60 s; `phone_open_accessibility`
  waits up to 240). It is the start's budget too, so the script leaves at
  once with no bridge in its env, or when Cline retries a failed start
  with `Content-Length` framing, which it doesn't speak.
- `test/phonecando-mcp.test.mjs` runs the script against a fake bridge.

Trust (`phoneToolsTrust`: `phonecando.js`): the plugin's `beforeTool`
returns `{policy: {autoApprove: true}}` for a tool named `phonecando__…`
while the engine has the bridge. The agent loop merges a hook's policy
over the session's tool policies before it decides to ask
(`sdk/packages/agents/src/agent-runtime.ts:2457-2509`; "`policy` …"
in `docs/sdk/plugins.mdx:197`), so our tools never ask, in the TUI, the
hub and ACP mode, and every other tool keeps your setting. Nothing else
could do it in 3.0.74:

- No per-server or per-tool `autoApprove` in the MCP settings: the schema
  has no such field and drops it (`config-loader.ts:111-119`). PR #15722
  brings per-server lists back for the VS Code extension only.
- No per-tool flag or setting: `--auto-approve <bool>` and the global
  `toolAutoApprove` cover every tool (`main.ts:884-895`,
  `sdk/packages/core/src/services/global-settings.ts:317-333`);
  `disabledTools` only turns tools off.
- A hook file can't approve: a `PreToolUse` answer has `cancel`,
  `context`/`contextModification`, `errorMessage` and `overrideInput`,
  no policy (`hook-file-hooks.ts:191-222, 577-605`).
- The TUI's dialog is yes or no (`tool-approval.tsx:143-149`).

The script stays until Cline expands variables in a remote server's
`url` and `headers`. #15740 would let ACP mode take the bridge from
session/new (`tools: session`); the TUI would still need our file.

## Messages

Level `wakes`; the manifest's `inbox` is `reader` with `wake: reader`.
The plugin reads `$PHONECANDO_INBOX` as the kit's `phonecando-inbox`
does: it claims `pending/` by renaming it, takes the runner's
`messages.txt` (else the `block`s of `messages.jsonl`), appends
`@inbox<TAB><ids>` to `$PHONECANDO_EVENTS` and removes what it took.

- While Cline works: `afterTool` returns them as `appendContext`, a
  `<hook_context>` message the model reads before its next request
  (`sdk/packages/shared/src/agent.ts:460-475`).
- At a run's start (your next prompt): `beforeRun` returns them the same
  way (`agent.ts:398-408`).
- Waking: while it is idle, the plugin looks every second; a set the
  runner marked (`pending/wake`) is claimed and queued as a prompt
  (`ctx.emitEvent("queue_message", {prompt})`), which starts a turn at
  once on an idle chat (`sdk/packages/core/src/runtime/host/local/agent-event-bridge.ts:213-239`,
  `sdk/packages/core/src/runtime/turn-queue/pending-prompt-service.ts:256-279, 312-325`;
  Cline's own `sdk/examples/plugins/background-terminal.ts:167-175`
  steers into a chat this way). It shows in the chat as a prompt. One
  queued wake at a time, until its run starts (or 30 s).
- An unmarked set while it is idle waits for your next prompt.
- ACP mode: the runner never marks a set there (only its prompt wakes
  ACP mode), and the plugin queues nothing when Cline names its client
  `cline-acp`.
- A plugin lives in a session: in a TUI that has no chat yet (its home
  screen) there is none, so nothing can wake it, and messages wait until
  your first prompt. Owed: a phone check of when Cline sets plugins up
  (`sdk/packages/core/src/runtime/host/local-runtime-host.ts:744` says on
  the first turn, `plugin-sandbox.ts:555-560` at session start).
- No hook can continue a turn at its end: `afterRun` returns nothing, and
  the `TaskComplete` hook file runs detached. The queued prompt is the way
  in.

## Owed (phone)

- A signed-in TUI turn: our tools run without a question with
  auto-approve off, shell tools still ask; the events reach the phone;
  a message mid-turn reaches the model; an idle chat wakes and shows the
  message as a prompt.
- Whether the TUI in hub mode shows a prompt the plugin queued, and the
  first `beforeTool` call's payload: Cline's worker warns once
  (`console.warn`) when a hook payload isn't JSON-safe
  (`plugin-sandbox.ts:707-748`), and the tool object has functions.
- `--phonecando-continue` on the phone: `cline history --json` rows and
  how long the extra start takes in proot.
- A second Cline agent: its own sign-in and chats in its folder, its
  plugin copy, and the hub port taken by the first.
- ACP mode: a signed-in turn with phone tools and no question for them.

## Local models

None: Cline takes a model server only from its own config.
