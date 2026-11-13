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
- `VIBE_HOME=~/.vibe-agent`: the agent has a Vibe folder of its own, so
  we can add our hooks without touching yours (`~/.vibe`, which a `vibe`
  you run by hand in a terminal still uses, with its own sign-in).
- `VIBE_ENABLE_UPDATE_CHECKS=false` goes through Vibe's `VIBE_*`
  environment layer.
- `resume` adds `--continue`; with no chat for the folder Vibe starts a
  new one.
- `prompt` (a scheduled task) appends `-- <task>`, after `--continue`: the
  positional is the interactive session's first prompt (`-p` would be the
  headless one), and `--` keeps it from being read as an option or a
  subcommand (v3.1.2: `vibe/cli-rust/src/cli.rs` `initial_prompt`,
  `event_handler.rs` `process_initial_prompt`; the Python `vibe` launcher
  passes its args on as they are).
- The window title is the chat's title or `Vibe`. To a terminal that does
  not answer the 7501 query Vibe adds state marks (`>>`, `?`,
  `- Action Required`, `- Task Complete`); `surfaces.chatTitle` takes the
  title without them and skips the default.

## State

- Global instructions: `~/.vibe-agent/AGENTS.md`, seeded when absent.
- Our config (`config/`: `hooks.toml`, `AGENTS.md`) is seeded into the
  agent's Vibe folder; a second Vibe agent on the machine gets a folder
  of its own (`VIBE_HOME` in its state folder, our config seeded there
  too). The machine has no keyring, so its keys go to `$VIBE_HOME/.env`.
- `userState`: `~/.vibe-agent`.

## Events

Our `hooks.toml` carries only the message hooks (Messages, below); events
come from OSC 7501. Vibe writes those reports unprompted
(`experimental_enable_tab_status`, on by default); the usual map. It also
sends the support query, and once the runner answers its bell stays off.

## Messages

Delivered (an `inbox` block, no wake), through the hooks in our
`hooks.toml` (Vibe 3.1 loads them from `$VIBE_HOME/hooks.toml`):
`pre_agent` adds them to the turn before the model reads it, `post_tool`
after each tool that ran (`hook_specific_output.additional_context`),
and `post_agent` sends them as a follow-up once the agent is done
(`decision: "deny"` with them as `reason`; Vibe allows 3 a turn). With
none waiting the script prints nothing and Vibe passes through. An idle
Vibe can't be woken: messages wait for its next turn.

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
