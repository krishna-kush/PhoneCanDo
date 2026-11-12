# pi

The pi coding agent (now published by Earendil), installed from npm on our
`node` runtime and run as a TUI in the agent's machine, with one pi
extension of ours, `config/phonecando.ts` (with `messages.ts` and
`inbox.ts` beside it). Shared image-kind rules: `agents/AGENTS.md` §4.

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

## State

- Global instructions: `~/.pi/agent/AGENTS.md`.
- A second pi agent on the machine keeps its state in its own folder
  (`PI_CODING_AGENT_DIR`); our extension stays in `~/.phonecando/pi`.
- `userState`: `~/.pi/agent`.

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

## Messages

Other agents' messages (the manifest's `inbox`: `reader`, `wake: reader`):
the extension looks in `$PHONECANDO_INBOX` every second and claims
`pending/` as the kit's `phonecando-inbox` does (a rename), hands pi the
runner's `messages.txt` as a custom message (`pi.sendMessage`, shown in the
chat, read by the model as user text) and appends the `@inbox` receipt to
`$PHONECANDO_EVENTS`.

- While pi works: steered (`deliverAs: "steer"`), after the current tool
  calls and before the next model request.
- While it is idle: left waiting for your next prompt, which they join
  (`before_agent_start` returns them as its message).
- Waking: when the runner marks them (`pending/wake`), `triggerTurn: true`
  starts a turn while pi is idle.
- `test/inbox.test.mjs` covers the folder reader; it ships nowhere.

## Local models

None yet: pi takes a model server only from an extension
(`pi.registerProvider`), and ours registers none.
