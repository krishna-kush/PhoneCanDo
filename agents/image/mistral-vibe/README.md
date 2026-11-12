# mistral-vibe

Mistral AI's Vibe, installed from PyPI with uv (our `python` runtime) and
run as a TUI in the agent's machine. Shared image-kind rules:
`agents/AGENTS.md` §4.

## Install

- Python 3.12 from the runtime (Vibe wants 3.12 or newer).
- No Alpine: Vibe's aarch64 wheel (it carries a Rust TUI) is
  `manylinux_2_28` only, and some dependencies have no musl wheels.
- `uv tool install`, as Mistral's own installer does.

## Launch

- An `sh -c` wrapper, so it can fill in the phone tools (below).
- `VIBE_ENABLE_UPDATE_CHECKS=false` goes through Vibe's `VIBE_*`
  environment layer.
- `resume` adds `--continue`; with no chat for the folder Vibe starts a
  new one.
- The window title is the chat's title or `Vibe`. To a terminal that does
  not answer the 7501 query Vibe adds state marks (`>>`, `?`,
  `- Action Required`, `- Task Complete`); `surfaces.chatTitle` takes the
  title without them and skips the default.

## State

- Global instructions: `~/.vibe/AGENTS.md`.
- A second Vibe agent on the machine keeps its state in its own folder
  (`VIBE_HOME`). The machine has no keyring, so its keys go to
  `$VIBE_HOME/.env`.
- `userState`: `~/.vibe`.

## Events

No hooks: Vibe loads them only from `~/.vibe/hooks.toml`, a trusted
project's `.vibe/hooks.toml` or a plugin, with no flag or variable for one
more file. It writes OSC 7501 reports unprompted
(`experimental_enable_tab_status`, on by default); the usual map. It also
sends the support query, and once the runner answers its bell stays off.

## Phone tools

With the bridge, the wrapper sets `VIBE_MCP_SERVERS` to one
`streamable-http` server, `phonecando`, at `$PHONECANDO_BRIDGE_URL/mcp`
with `auth = {type: "static", api_key_env: "PHONECANDO_BRIDGE_TOKEN"}`.
The `sh` fills in the URL because that layer takes JSON with no
variables; Vibe reads the token from the environment per request. Vibe
merges `mcp_servers` from every layer by name, so yours in
`~/.vibe/config.toml` stay.

## Local models

None: Vibe takes a custom model server only from `~/.vibe/config.toml`.
