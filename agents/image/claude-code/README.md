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
- `prompt` (a scheduled task) appends `-- <task>`: `claude "query"`
  starts the interactive session with that first prompt, with
  `--continue` too (code.claude.com/docs/en/cli-reference; tried with
  2.1.306). `--` ends `--mcp-config`, which takes several values and
  would read the task as one more.
- `config/settings.json` allows `mcp__phonecando__*`: our phone tools
  never ask, since the phone-control lock is their check. Every other
  tool asks by your own rules, and a deny or ask rule of yours still wins
  (code.claude.com/docs/en/permissions, MCP).
- The window title is `<glyph> <title>` (`✳` idle, `◐`/`◑` working), and
  `Claude Code` until the chat has a title; `surfaces.chatTitle` skips
  that default.

## State

- Global instructions: `~/.claude/CLAUDE.md`.
- A second Claude Code agent on the machine keeps its sign-in, settings,
  chats, `.claude.json` and `CLAUDE.md` in its own folder
  (`CLAUDE_CONFIG_DIR`).
- `userState`: `~/.claude` and `~/.claude.json`. The install
  (`~/.local/share/claude`, `~/.local/bin/claude`) is not in them.

## ACP mode

Claude Code has no ACP mode of its own: `engine.acp` runs the adapter
`claude-agent-acp` (npm `@agentclientprotocol/claude-agent-acp`, the ACP
registry's `claude-acp` entry), which the install and update steps add on
our `node` runtime (it wants Node 22).

- `CLAUDE_CODE_EXECUTABLE` points the adapter at the Claude Code the
  installer put in `~/.local/bin` (0.106.0 `dist/claude-cli.js` reads it
  first), so there is one Claude Code, one version and one set of chats.
  `--omit=optional` keeps npm from also fetching the SDK's own Claude Code
  build (the trial's install was 402 MB with it).
- `tools: session`: terminal mode adds the bridge in argv
  (`--mcp-config`), which the adapter has no way to take; the runner hands
  it over in session/new instead.
- `options: {mode: default}`: the adapter opens a chat in `auto`, which
  needs Claude's safety check and denied our trial's tool call; `default`
  makes it ask, so the phone asks you.
- `meta`: `_meta.claudeCode.options.settings` names our settings file. The
  adapter reads the file and hands it to Claude Code as its `--settings`
  layer (0.106.0 `dist/session-env.js` `configuredSettings`,
  `dist/v1/acp-agent.js`), so our hooks run as in terminal mode, your
  `~/.claude` stays yours, and your user, project and local settings
  still load.
- `chat`: `--resume <id>` at 1. The ACP chat id is Claude Code's session
  id (the chat is `~/.claude/projects/<folder>/<id>.jsonl`), so the
  terminal opens the chat the background run used.
- PC trial (2026-11-13, x86_64, adapter 0.106.0, a fake model): full
  turns, tools over HTTP MCP from session/new, a permission asked with
  allow once, allow always and reject, back-to-back prompts, and
  session/load after a restart. Our hooks ran (from a user-level settings
  file there, not this `_meta` path), a message dropped mid-turn reached
  the model through `PostToolBatch`, and turns ended at once with our
  `Stop` waiter (`asyncRewake`) in place.
- Owed: a phone check (arm64 under proot) with the installed Claude Code
  and the `_meta` settings path.

## Events

`--settings` names our `config/settings.json` (seeded to
`~/.phonecando/claude-code/`), which adds our hooks; Claude Code merges
them with your settings (hooks from every level run). `UserPromptSubmit`
working, `Notification` (permission and MCP input prompts only) waiting,
`Stop` and `SessionEnd` finished, `StopFailure` (an API error ended the
turn) failed. An interrupted turn fires no `Stop`.

## Messages

Other agents' messages come in through hooks running the kit's
`phonecando-inbox` (the manifest's `inbox`):

- `PostToolBatch`: once after each batch of tool calls (failed ones too),
  before the next model request, as `additionalContext`.
- `UserPromptSubmit`: with your next prompt, as `additionalContext`.
- Waking (`wake: hook`): every `Stop` also starts a background hook
  (`asyncRewake`) that waits up to an hour for messages allowed to wake
  the agent (`--wait Stop 3600`, hook `timeout` 3660, which Claude Code
  enforces on it). It prints them on stderr and exits 2, which wakes an
  idle Claude Code at once; the model reads them as a system
  notification ("not user input") headed `Stop hook blocking error from
  command "Stop":`, so our template starts by saying it is not an error.
  The hook then raises `Woken` (working). The newest waiter wins, and the
  `SessionEnd` hook (`--cancel`) ends it when Claude Code exits.
- So an agent can be woken only within an hour of its last finished
  turn (an interrupted or failed turn starts no waiter): not before its
  first one, nor once the waiter timed out. Those messages wait for its
  next prompt.
- Background hooks run this way only in the interactive TUI; with `-p`
  Claude Code would wait for them, so the one-shot mode passes no
  `--settings`.

## Phone tools

`--mcp-config` adds an HTTP MCP server at `${PHONECANDO_BRIDGE_URL}/mcp`
with `Bearer ${PHONECANDO_BRIDGE_TOKEN}`, which Claude Code expands from
its environment. With no bridge neither is set and the server fails to
connect.

## Local models

Over `anthropic`:

- `--permission-mode default` (the arg): from 2.1.283 Claude Code starts
  in `auto`, whose safety check runs on Anthropic's server. Through our
  server it never gets through, so Claude Code asks about every action
  and offers to leave for accept-edits. `default` (Manual) asks as
  Claude Code did before `auto`, by your allow rules, with no check to
  wait on; on its own cloud it keeps starting in `auto`. No env sets the
  mode, and the flag wins over any `permissions.defaultMode` in your
  settings (code.claude.com/docs/en/permission-modes), so on a local
  model it also starts in `default` when you chose another; Shift+Tab
  still switches. The ACP adapter ignores args it does not know, and its
  chats already start in `default` (ACP mode, `options`). The one-shot
  run (`-p`) gets it too, where it is the default anyway.
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
