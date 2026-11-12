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
- `GOOSE_ADDITIONAL_CONFIG_FILES` names our seeded `config/config.yaml`.
  goose reads it after `/etc/goose/config.yaml` and before your own
  `config.yaml`, which wins, and never writes to it.
- goose has no update check of its own. Its first session asks whether to
  share anonymous usage data.
- `resume` adds `-r` (the newest session). With none goose exits 1, and
  the runner's resume fallback starts it without.
- No `chatTitle`: the window title is `🪿 <folder>`.

## State

- Global instructions: `~/.config/goose/.goosehints`.
- A second goose agent on the machine keeps its config, data and state in
  its own folder (`GOOSE_PATH_ROOT`), its keys in its config file
  (`GOOSE_DISABLE_KEYRING=1`). The wrapper then looks for a provider in
  `$GOOSE_PATH_ROOT/config/config.yaml`.
- `userState`: `~/.config/goose` and `~/.local/share/goose`.

## Events

No hooks. OSC 7501, unprompted, with the usual map. Its bell
(`GOOSE_CLI_BELL`) stays off.

## Phone tools

Our config file adds the `phonecando` extension (`streamable_http`,
`${PHONECANDO_BRIDGE_URL}/mcp`, `Bearer ${PHONECANDO_BRIDGE_TOKEN}`, both
read through `env_keys`).

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
