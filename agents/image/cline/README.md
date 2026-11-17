# cline

The Cline CLI, installed from npm on our `node` runtime and run as a TUI
in the agent's machine. Shared image-kind rules: `agents/AGENTS.md` §4.

## Install

`cline` is a small Node launcher for Cline's Bun-built binary,
`@cline/cli-linux-arm64`, which npm installs beside it. That binary is
glibc-only, so no Alpine.

## Launch

- No `resume`: Cline has no `--continue`.
- `prompt` (a scheduled task) starts it as `cline --tui -- <task>`: the
  TUI with the task as its first prompt (`apps/cli` 3.0.74:
  `src/main.ts` runs the TUI with `initialPrompt` for `-i/--tui`,
  `src/tui/root.tsx` submits it once sign-in is done). Never without
  `--tui`: a bare `cline <prompt>` runs it once, in yolo mode, and exits.
- Its TUI may start its local hub daemon (`cline hub`, port 25463); the
  runner reaps it with the engine.
- The window title is `Cline`, then `> <your prompt>` once a task runs;
  `surfaces.chatTitle` takes the prompt.

## State

- No single global instructions file (its rules are a folder of files).
- One Cline agent per machine: each would need a hub port of its own, and
  the hub outlives the agent.
- `userState`: `~/.cline`.

## ACP mode

`cline --acp` (the ACP registry's `cline` entry; "Run in Agent Client
Protocol (ACP) mode" in `cline --help`, 3.0.74).

- ACP mode never reads the provider and model saved in
  `~/.cline/data/settings/providers.json` (what its TUI uses): a new or
  reloaded session takes `CLINE_PROVIDER`, else `cline`, and the
  provider's default model (`apps/cli/src/acp/acpAgent.ts` `newSession`,
  `loadSession`, `resolveDefaultModelId`, cli-v3.0.74). With the default,
  a free account's scheduled task failed on the phone ("Insufficient
  balance", `anthropic/claude-sonnet-5.5`, 2026-11-17).
- Provider, through `sh -c`: the script reads `lastUsedProvider` there
  with node and exports it as `CLINE_PROVIDER` (only when unset and a
  plain id), then execs `cline --acp`.
- Model, through the code hook `cline.model` (`optionsHook`,
  `kotlin/.../ChosenModel.kt`): when a chat opens, the runner reads that
  provider's `settings.model` from the machine's HOME (only those two
  fields; the file also holds sign-in tokens) and sets it as the `model`
  config option. Not `CLINE_MODEL`: Cline takes it only when its
  chat-model list (`Llms.getModelsForProvider(provider, {filter:
  "chat"})`) has it, and that list leaves out the free `cline-free/*`
  models, so it fell back to the default (phone, 2026-11-17). Its
  `setSessionConfigOption` takes any `model` value as it is
  (`acpAgent.ts`, `case "model"`), so the runner sets a hook's value even
  when the option's list (`config-options.ts` `buildModelConfigOption`,
  the same chat list) does not name it. Owed: a phone check that a
  scheduled task runs on the free model.
- No phone tools and none of Cline's own hooks (below), so `tools` does
  not apply: ACP mode lets it run a scheduled task while nobody watches,
  with its questions asked on the phone.
- `chat`: `--tui --id <session-id>` opens that session in the TUI and
  waits for input, with no prompt (phone, 2026-11-17, 3.0.74). An ACP
  chat's id is one of Cline's own sessions (`~/.cline/data/sessions/<id>/`,
  e.g. `1794913202337_tiqRE_cli`, `source: cli`), so after an ACP run, or
  a tap on a scheduled run, the terminal opens that chat.
- PC trial (2026-11-13, 3.0.74): the handshake only; a chat needs
  sign-in. Owed: a signed-in turn (whether it asks before tools, or
  approves them all as its `--auto-approve` default does), whether ACP
  mode starts the hub, and a phone check.

## Events

None. Cline runs hooks (files named after the event, such as
`TaskStart.sh`) only from `~/.cline/hooks`, `~/Documents/Cline/Hooks` and
the workspace's `.clinerules/hooks`. `--hooks-dir` sets `CLINE_HOOKS_DIR`,
which nothing reads yet. A file of ours there could overwrite one of yours
with the same name, so we add none.

## Phone tools

None. Its MCP servers live in `~/.cline/data/settings/cline_mcp_settings.json`
(`CLINE_MCP_SETTINGS_PATH` moves it) with no variable expansion, so the
bridge token would have to be written to disk.

## Messages

With no phone tools (above) it can't send messages or check its inbox. Its
ACP mode still gets other agents' messages as a prompt while it is idle, so
its level is `wakes`, but it can't answer them through the tools.

## Local models

None: Cline takes a model server only from its own config.
