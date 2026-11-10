# pi

The pi coding agent (now published by Earendil), installed from npm on our
`node` runtime and run as a TUI in the agent's machine, with one pi
extension of ours, `config/phonecando.ts`. Shared image-kind rules:
`agents/AGENTS.md` §4.

## Install

- The package wants Node 22.19 or newer: on Alpine the image's own Node
  must be new enough.
- `fd` (`fd-find` on Debian and Fedora): without `fd` or `fdfind` on PATH,
  pi downloads one from GitHub on first start.
- `@earendil-works/pi-coding-agent`; the old `@mariozechner/pi-coding-agent`
  is deprecated.

## Launch

- `-e /root/.phonecando/pi/phonecando.ts` adds our extension to the ones
  pi finds itself, so `~/.pi/agent/` stays yours.
- `resume` adds `--continue`; with no chat for the folder pi starts a new
  one.
- The window title is `π - <folder>`, or `π - <chat name> - <folder>` once
  the chat has a name (`/name`); `surfaces.chatTitle` takes the name.

## Events

- The extension, through `phonecando-event`: `agent_start` raises
  `AgentStart` (working), `ui_prompt_start` (a dialog waits for you)
  `PromptStart` (waiting), and `agent_settled` (pi will not go on by
  itself) `AgentSettled` (finished), or `AgentFailed` (failed) when the
  run's last reply ended in an error.
- OSC 7501 after the support query; the usual map. A run aborted with Esc
  raises no extension event; 7501's `idle` ends it as stopped. With
  `terminal.showTerminalProgress` on, pi also writes OSC 9;4 progress.

## Phone tools

The extension calls `pi.registerMcpServer("phonecando", …)` with
`${PHONECANDO_BRIDGE_URL}/mcp` and `Bearer ${PHONECANDO_BRIDGE_TOKEN}`,
only when the runner gave the engine the bridge. A `phonecando` server in
your own `~/.pi/agent/mcp.json` would win.

## Local models

None yet: pi takes a model server only from an extension
(`pi.registerProvider`), and ours registers none.
