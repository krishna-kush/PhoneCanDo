# crush

Charm's Crush, downloaded from its GitHub release and run as a TUI in the
agent's machine. Shared image-kind rules: `agents/AGENTS.md` §4. Licence
FSL-1.1-MIT: we only point the phone at Charm's release and never ship or
host Crush (`NOTICE.md`).

## Install

Crush is one static Go binary, so every family works, Alpine included.
The steps read the latest version from the `releases/latest` redirect,
check the tarball against the release's `checksums.txt`, and move `crush`
into `~/.local/bin` (written beside it, then renamed over the old one).
That is the release install Charm documents; the npm package only wraps
the same download in Node. A last step links `/etc/crush/crush.json` to
our `config/crush.json` (seeded to `/root/.phonecando/crush/`; see Phone
tools), unless that path already holds a file of your own. A Crush agent
made before this step gets the link from Update agent.

## Launch

- Crush checks GitHub for a newer release on each start and shows a
  notice. There is no switch for it, and it never updates itself.
- `resume` adds `--continue`, the newest chat.
- No `prompt`, so it cannot run scheduled tasks: the TUI takes no first
  prompt (v0.101.0 `internal/cmd/root.go`: `crush <text>` is an unknown
  command), and `crush run` answers once without the TUI.
- No `chatTitle`: the window title is `crush <folder>`.

## State

- Global instructions: `~/.config/crush/CRUSH.md`.
- One Crush agent per machine: its per-project `.crush` lock would need a
  data folder per agent, which we cannot template.
- `userState`: `~/.config/crush` and `~/.local/share/crush`.

## Events

OSC 7501, unprompted, with the usual map; our hooks (see Messages) carry
messages only. Its
own notifications (`option notifications osc` or `bell`) stay off: it
turns on focus reports only when the terminal answers its mode query
(DECRQM 1004), which ours does not.

## Phone tools

Our `config/crush.json` names the bridge as an HTTP MCP server, with
`${PHONECANDO_BRIDGE_URL}` and `${PHONECANDO_BRIDGE_TOKEN}` that Crush
expands itself when it connects (v0.67.0 on; `MCPConfig.ResolvedURL` and
`ResolvedHeaders`, `internal/config/config.go`). Its errors show the
template, never the value (`resolve.go` `sanitizeResolveError`).

Crush has no flag or variable for one more config file: `CRUSH_GLOBAL_CONFIG`
and `XDG_CONFIG_HOME` move your whole global config (and, for XDG, every
other program's). It does read `/etc/crush/crush.json` (v0.87.0 on), the
lowest layer, merged under your global, project and workspace configs
(`internal/config/load.go` `lookupConfigs`), so the install links that
path to our file:

- It adds to your config: your own MCP servers and hooks stay, and yours
  win where both name the same key, so you can turn `phonecando` off.
- It holds only templates, so the token is never on disk. Proven on the
  PC with the v0.101.0 release against a fake bridge: both our server and
  one from a user `crushrc` connected, ours with the token from the
  environment, and the token was in no file, debug log included.
- It is machine-wide: `crush` run in this machine's terminal has no bridge
  in its environment, so it lists `phonecando` as failed and goes on.
- Our tools never ask: the phone-control lock is their check. A
  `PreToolUse` hook with the matcher `^mcp_phonecando_` (Crush names MCP
  tools `mcp_<server>_<tool>`; the matcher is a regex over that name)
  prints `{"decision":"allow"}`, which approves the call before Crush's
  prompt (v0.101.0 `internal/hooks`, `internal/permission`). It covers
  tools we add later; Crush's own tools ask as before, and a deny of yours
  still wins. `permissions.allowed_tools` would need every tool's exact
  name.
- `sessionless`: the bridge keeps no MCP session and answers GET with 405,
  so Crush opens no listen stream. `timeout` covers only the connect and
  ping; a tool call (a long `agents_wait`) has no limit there.

## Messages

`inbox.hooks`: `PostToolUse` and `PostToolUseFailure` from the same file
run `phonecando-inbox`, and Crush appends the `context` they print to the
tool's result (v0.99.0 on; `internal/agent/hooked_tool.go`). Hook events
are checked when the config loads, so a Crush older than v0.99.0 would
refuse to start with them; install and update always fetch the latest.

No `wake`: Crush's turn hooks (`TurnEnd`, `SessionStart` and the rest)
only observe, and it has no ACP mode yet (PR #2450), so messages wait for
its next tool call. Its level is `delivered`.

Later, maybe: Crush starts a turn from an MCP "channel" notification
(v0.97.0 on). The bridge would have to declare `claude/channel` and push
over a GET stream, and our file would set `channel_enabled`.

Phone check: start a Crush agent (or Update agent on an old one) and ask
it to list its tools; the `phonecando` tools should be there, and a
`mobile_*` call should work. Send it a message from another agent while
it works; it should see the message after its next tool call.

## Local models

None: Crush takes a custom model server only from its config file
(`providers`).

## Sign-in

Besides an API key, `crush login` signs in to Charm Hyper or GitHub
Copilot with a device code, or to OpenAI with a browser.
