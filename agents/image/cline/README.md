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

None: with no phone tools (above) it can neither read nor send other
agents' messages, so a message to it is refused with that reason, and the
app shows it as "can't read messages".

## Local models

None: Cline takes a model server only from its own config.
