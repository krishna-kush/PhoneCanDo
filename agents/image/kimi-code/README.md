# kimi-code

Moonshot AI's Kimi Code CLI, installed from npm on our `node` runtime and
run as a TUI in the agent's machine. Shared image-kind rules:
`agents/AGENTS.md` §4. This is the TypeScript CLI
(`@moonshot-ai/kimi-code`, command `kimi`); the Python `kimi-cli` on PyPI
is archived.

## Install

- The package wants Node 22.19 or newer: on Alpine the image's own Node
  must be new enough.
- npm, not Moonshot's `install.sh`, which ships a glibc-only binary and
  edits shell profiles; npm works on every family.

## Launch

- An `sh -c` wrapper: before Kimi starts it runs our
  `phonecando-mcp.mjs` (below), then execs Kimi with its args.
- `KIMI_CODE_HOME=~/.kimi-code-agent`: the agent has a Kimi folder of its
  own, so we can add our MCP server without touching yours
  (`~/.kimi-code`, which a `kimi` you run by hand in a terminal still uses,
  with its own sign-in).
- `resume` adds `--continue`; with no chat for the folder Kimi starts a
  new one.
- No `prompt`, so it cannot run scheduled tasks: the TUI takes no first
  prompt (2.6.1 `apps/kimi-code/src/cli/commands.ts`: an argument is an
  unknown command), and `-p` answers once without the TUI.
- The window title is the chat's title (cut to 32 characters) or `Kimi
  Code`; `surfaces.chatTitle` skips the default.

## State

- Global instructions: `~/.kimi-code-agent/AGENTS.md`, seeded when absent.
- Our config (`config/`: `phonecando-mcp.mjs`, `AGENTS.md`) is seeded into
  the agent's Kimi folder; a second Kimi Code agent on the machine gets a
  folder of its own (`KIMI_CODE_HOME` in its state folder, our config
  seeded there too).
- `userState`: `~/.kimi-code-agent`.

## Events

No hooks of ours (Messages, below). Kimi sends the OSC 7501 support query and
reports once the runner answers; the usual map. Its subagents report as
child records (`id=agent-…`); only their `blocked` counts. Its own
notifications go out only while the terminal reports it is not focused.

## Phone tools

`phonecando-mcp.mjs` puts a `phonecando` server into the agent's
`$KIMI_CODE_HOME/mcp.json` before each start, keeping your other servers:
Kimi reads no variables in `mcp.json`, so the bridge's URL (its port can
change) is written each time, while the token stays in the environment,
named by `bearerTokenEnvVar`.

## Messages

Pull only (no `inbox` block): Kimi's hooks live in the same `config.toml`
as its sign-in and providers, so we add none; other agents' messages wait
until Kimi calls `agents_inbox`, which its seeded `AGENTS.md` asks it to
do when a task starts, and every phone tool's result says how many are
unread.

## Local models

Over `openai-chat`: Kimi's `KIMI_MODEL_*` variables (provider type
`openai`, the server's `/v1`, the model, its key and context).
