# goose

goose (the Agentic AI Foundation's open-source agent, from Block),
installed with goose's installer and run as a TUI in the agent's machine.
Shared image-kind rules: `agents/AGENTS.md` §4.

An image kind, not a native one: goose's aarch64 builds are about 120 MB
unpacked, too big for the APK.

## Install

The installer (`download_cli.sh` from the `stable` release, run with
`CONFIGURE=false`) picks the aarch64 build for the machine's C library,
glibc or musl, so Alpine works (with `libgcc`).

## Launch

- An `sh -c` wrapper: goose exits at once with "No provider configured"
  when there is none, so the wrapper first runs `goose configure` (goose's
  own setup, in the same terminal) when neither `GOOSE_PROVIDER` is set
  nor the agent's config file (`~/.config/goose/config.yaml`, or
  `$GOOSE_PATH_ROOT/config/config.yaml` for an agent with its own state
  folder) names a provider.
- With the phone tools on, the wrapper first runs our seeded `trust.sh`
  (Phone tools, below).
- `GOOSE_ADDITIONAL_CONFIG_FILES` names our seeded `config/config.yaml`.
  goose reads it after `/etc/goose/config.yaml` and before your own
  `config.yaml`, which wins, and never writes to it.
- goose has no update check of its own. Its first session asks whether to
  share anonymous usage data.
- `resume` adds `-r` (the newest session). With none goose exits 1, and
  the runner's resume fallback starts it without.
- `prompt` (a scheduled task) adds `--text <task>`. `goose session` takes
  no prompt, so the wrapper runs `goose run --interactive "$@"` instead
  when its args hold `--text`: the same interactive loop, with the task
  as its first message (v1.59.0: `crates/goose-cli/src/cli.rs` `run`'s
  `-t/--text`, `-s/--interactive`, `-r/--resume`; `session/mod.rs`
  `interactive(prompt)`). Read in the source, not yet run on a phone.
- No `chatTitle`: the window title is `🪿 <folder>`.

## State

- Global instructions: `~/.config/goose/.goosehints`.
- A second goose agent on the machine keeps its config, data and state in
  its own folder (`GOOSE_PATH_ROOT`), its keys in its config file
  (`GOOSE_DISABLE_KEYRING=1`). The wrapper then looks for a provider in
  `$GOOSE_PATH_ROOT/config/config.yaml`.
- `userState`: `~/.config/goose` and `~/.local/share/goose`.

## ACP mode

`goose acp` (the ACP registry's `goose` entry; "Run goose as an ACP agent
server on stdio" in `goose acp --help`, 1.59.0).

- Not through the launch's `sh -c`: the wrapper only adds `goose
  configure` when no provider is set, which needs a screen. With none the
  ACP chat fails and the runner says so; set one up in the terminal
  first.
- `tools: config`: `GOOSE_ADDITIONAL_CONFIG_FILES` is in the launch env,
  so ACP mode reads our config file and its `phonecando` extension too;
  the runner adds no server in session/new, so there is one `phonecando`.
- No `options`: its ACP chats start in `auto`, goose's usual mode, which
  runs tools without asking, as the TUI does.
- `chat`: `-r --session-id <id>`, appended, so `goose session` resumes
  that one (`--session-id` "Requires --resume"). ACP chats live in goose's
  own sessions database (`~/.local/share/goose/sessions/sessions.db`).
- PC trial (2026-11-13, 1.59.0, a fake model): full turns, tools over HTTP
  MCP from session/new, back-to-back prompts, and session/load after a
  restart.
- Owed: our extension from the config file in ACP mode (the trial handed
  the bridge over in session/new), resume by id, and a phone check.

## Events

No hooks. OSC 7501, unprompted, with the usual map. Its bell
(`GOOSE_CLI_BELL`) stays off.

## Phone tools

Our config file adds the `phonecando` extension (`streamable_http`,
`${PHONECANDO_BRIDGE_URL}/mcp`, `Bearer ${PHONECANDO_BRIDGE_TOKEN}`, both
read through `env_keys`).

Our tools never ask, since the phone-control lock is their check. goose's
own mode, `auto`, runs every tool without asking; in `approve` or
`smart_approve`, a tool in `user.always_allow` of goose's `permission.yaml`
still runs at once. That file is the only place for it (v1.60.1
`crates/goose/src/config/permission.rs`: `permission.yaml` in the config
folder, `~/.config/goose` or `$GOOSE_PATH_ROOT/config`), it takes each
tool's full name with no wildcard (`phonecando__<tool>`, the extension's
key and the tool, `agents/extension_manager/mod.rs`), and goose refuses to
start on one it can't read. So `trust.sh` (POSIX sh) writes a missing or
empty file whole and otherwise adds only our missing names, and only to the
plain block shape goose writes itself; a file in any other shape, or a
link, stays as it is. Only our tools are listed: goose's shell and file
tools ask as before, and a tool we add to the bridge joins `trust.sh`.

## Messages

Inbox only (no `inbox` block): goose has the phone tools (above), so it
lists, sends and reads with the `agents_*` tools; nothing is pushed into
its turns (its hooks' effect on the model is not documented), so other
agents' messages wait until it calls `agents_inbox`, and every phone
tool's result says how many are unread.

## Local models

Over `openai-chat`, env only, since args would land on the `sh` wrapper:
`GOOSE_PROVIDER=openai`, `OPENAI_HOST` and `OPENAI_BASE_PATH` for the
server's `/v1/chat/completions`, `OPENAI_API_KEY`, `GOOSE_MODEL` and
`GOOSE_CONTEXT_LIMIT`. With `GOOSE_PROVIDER` set the wrapper skips
`goose configure`.

## Sign-in

goose keeps the key in `~/.config/goose/secrets.yaml` when the machine has
no keyring.
