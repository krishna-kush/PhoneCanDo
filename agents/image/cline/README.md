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

- No phone tools and no hooks (below), so `tools` does not apply: ACP
  mode lets it run a scheduled task while nobody watches, with its
  questions asked on the phone.
- No `chat`: `--id <session-id>` resumes a session, but we have not seen
  whether it opens the TUI without a prompt, nor whether ACP chats use
  the same ids. After an ACP run the terminal starts a new chat.
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
