# codex

OpenAI's Codex CLI, installed with OpenAI's installer and run as a TUI in
the agent's machine. Shared image-kind rules: `agents/AGENTS.md` §4.

An image kind, not a native one: the static `aarch64-unknown-linux-musl`
build is about 280 MB, far too big for the APK. The same build runs in
every image, Alpine included.

## Install

The installer runs with `CODEX_NON_INTERACTIVE=1` and `~/.local/bin`
already on PATH, so it leaves your shell profiles alone. A last step
links `/etc/codex/hooks.json` to our `config/hooks.json` (seeded to
`/root/.phonecando/codex/`; see Messages), unless that path already holds
a file of your own.

## Launch

Every setting is a flag, so `~/.codex/config.toml` stays yours.

- `--sandbox danger-full-access`: Codex's Linux sandbox (bubblewrap,
  seccomp, user namespaces) cannot work under proot. The agent's machine
  is the boundary: Codex can change anything in it, but nothing outside
  it. Approvals stay as your config says.
- `features.daemon_auto_start=false`: no shared background daemon left
  running after the engine.
- `tui.terminal_title=["thread-name"]`: the window title is the chat's
  name alone, which `surfaces.chatTitle` takes whole.
- `resume` puts `resume --last` before the flags; with no saved chat
  Codex starts a new one.
- `prompt` (a scheduled task) appends `-- <task>`: the TUI's optional
  first prompt, which it submits once the session is set up; after
  `resume --last` the one positional is that prompt, not a session id
  (rust-v0.168.0: `codex-rs/tui/src/cli.rs` `prompt`,
  `codex-rs/cli/src/main.rs` `resume_last_accepts_prompt_positional`).

## State

- Global instructions: `~/.codex/AGENTS.md`.
- A second Codex agent on the machine keeps its state in its own folder
  (`CODEX_HOME`).
- `userState` names files and folders in `~/.codex` (sign-in, config,
  history, sessions, archived sessions, instructions, memories, logs),
  never the folder itself: the installer keeps Codex in
  `~/.codex/packages/standalone`, which `~/.local/bin/codex` links to.
  Codex's SQLite state and log databases are not named yet.

## Events

- OSC 7501, unprompted, with the usual map.
- OSC 9 (`tui.notification_method="osc9"`, condition `always`) for what
  7501 may not cover, such as the plan-mode prompt: `Approval requested…`,
  `Codex wants to…`, `Plan mode prompt…` and `Question:…` are waiting,
  any other OSC 9 (a finished turn, its text the reply) finished. A
  failed turn writes no OSC 9; 7501's `error` covers it.

## Messages

Other agents' messages come in through Codex's hooks, which run
`phonecando-inbox`: `UserPromptSubmit` (turn start) and `PostToolUse`
(after each tool) add them as developer context
(`hookSpecificOutput.additionalContext`), and `Stop` keeps the turn going
once with them as its prompt (`decision: "block"`; skipped when
`stop_hook_active`, so at most once a turn). Codex cannot be woken when
idle: messages that come then wait for the next turn.

- Codex runs a hook only once you have trusted it in `/hooks` (it asks at
  start), except system ones, which are managed. `-c` hooks would need
  that review, or `--dangerously-bypass-hook-trust` for every hook, so
  ours sit in the system layer (`/etc/codex/hooks.json`, linked at
  install). `/hooks` lists them as managed, and they can't be turned off
  there.
- Codex saves context over 2,500 tokens to a file and gives the model a
  preview with its path.

## Phone tools

The MCP flags are a `when: bridgeUrl` item, because Codex does not expand
variables in `-c` values. It reads the token from the variable that
`bearer_token_env_var` names.

## Local models

Over `openai-responses`, a `local` provider in `-c` flags:

- `stream_idle_timeout_ms` is an hour: our server sends nothing until it
  has read the whole prompt, and the 5 min default gives up on a cold one.
- Codex starts with two `developer` messages. Some templates (Qwen3.5)
  refuse that; our llama-server patch (`lme/llamacpp/patches/`) then
  renders them as one system message.

Open checks: `lme/docs/planning/todo.md`.
