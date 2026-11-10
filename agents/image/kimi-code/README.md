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

- `resume` adds `--continue`; with no chat for the folder Kimi starts a
  new one.
- The window title is the chat's title (cut to 32 characters) or `Kimi
  Code`; `surfaces.chatTitle` skips the default.

## Events

No hooks (see Phone tools). Kimi sends the OSC 7501 support query and
reports once the runner answers; the usual map. Its subagents report as
child records (`id=agent-…`); only their `blocked` counts. Its own
notifications go out only while the terminal reports it is not focused.

## Phone tools

None: Kimi reads hooks (`config.toml`), MCP servers (`mcp.json`) and
notification settings (`tui.toml`) only from its home, `~/.kimi-code`,
with no flag for one more file. `KIMI_CODE_HOME` moves all of it, sign-in
and chats included.

## Local models

Over `openai-chat`: Kimi's `KIMI_MODEL_*` variables (provider type
`openai`, the server's `/v1`, the model, its key and context).
