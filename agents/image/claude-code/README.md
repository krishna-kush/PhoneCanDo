# claude-code

Anthropic's Claude Code, installed with Anthropic's installer (one native
binary, no runtime) and run as a TUI in the agent's machine. Shared
image-kind rules: `agents/AGENTS.md` §4.

## Install

- Alpine also needs `libgcc` and `libstdc++` for the musl build.
- dnf gets no `curl`: Fedora images ship `curl-minimal`, which conflicts
  with the `curl` package.

## Launch

- `USE_BUILTIN_RIPGREP=0`: the system `rg`, which Alpine needs.
- `resume` adds `--continue`, which exits 1 when the folder has no saved
  chat; the runner's resume fallback then starts it without.
- The window title is `<glyph> <title>` (`✳` idle, `◐`/`◑` working), and
  `Claude Code` until the chat has a title; `surfaces.chatTitle` skips
  that default.

## Events

`--settings` adds our hooks; Claude Code merges them with your settings
(hooks from every level run). `UserPromptSubmit` working, `Notification`
(permission and MCP input prompts only) waiting, `Stop` and `SessionEnd`
finished, `StopFailure` (an API error ended the turn) failed. An
interrupted turn fires no `Stop`.

## Phone tools

`--mcp-config` adds an HTTP MCP server at `${PHONECANDO_BRIDGE_URL}/mcp`
with `Bearer ${PHONECANDO_BRIDGE_TOKEN}`, which Claude Code expands from
its environment. With no bridge neither is set and the server fails to
connect.

## Local models

Over `anthropic`, env only:

- `CLAUDE_CODE_MAX_CONTEXT_TOKENS` is the server's context: Claude Code
  does not know our model ids and would assume 200k. The
  `[claude-code:unrecognized_model]` line on stderr is only a notice.
  Its own prompt is about 12.6k tokens, so it answers "Prompt is too
  long" on a 16k context; it needs a phone that can spare more.
- `ANTHROPIC_DEFAULT_HAIKU_MODEL` is the same model, for its background
  requests.
- `API_TIMEOUT_MS=0` and `API_FORCE_IDLE_TIMEOUT=0` let it wait out a cold
  prompt: our server sends no headers until it has read the whole prompt,
  minutes on a phone.
- `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` keeps it off Anthropic's
  other hosts.
- Claude Code sends its environment block as a `system` message after
  your prompt. Some templates (Qwen3.5) refuse that; our llama-server
  patch (`lme/llamacpp/patches/`) then renders it as user text.

Open checks: `lme/docs/planning/todo.md`.
