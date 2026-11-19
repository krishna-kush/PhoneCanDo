# cursor-cli

Anysphere's Cursor CLI (`cursor-agent`), installed with Cursor's installer
and run as a TUI in the agent's machine. Shared image-kind rules:
`agents/AGENTS.md` §4.

## Install

No Alpine: Cursor builds only for glibc (its bundled Node does not run on
musl).

## Launch

- `cursor-agent`, not `agent`, which another CLI also installs.
- Through `sh -c`, which first runs `phonecando-trust.mjs` when the phone
  tools are on (see Phone tools), then `exec`s `cursor-agent "$@"`; so
  `resume` and the ACP chat's args go in at 4, past the script's `$0`.
- `--plugin-dir /root/.phonecando/cursor`: the runner seeds `config/`
  there, a Cursor plugin (`.cursor-plugin/plugin.json`) loaded for this
  run only, so `~/.cursor/` stays yours but for our trust entries.
- Cursor has no switch to turn its own updates off.
- `resume` adds `--continue`; with no saved chat Cursor exits 1 and the
  runner's resume fallback starts it without.
- `prompt` (a scheduled task) appends `-- <task>`: `cursor-agent
  [prompt...]` submits it once the chat (the one `--continue` loaded) is
  up (cursor.com/docs/cli/reference/parameters; the 2026.11.11 build's
  `ui.tsx`).

## State

- No global instructions file we can write to.
- One Cursor CLI agent per machine: its sign-in moves only with
  `XDG_CONFIG_HOME`, which we keep for the machine.
- `userState`: `~/.cursor` and `~/.config/cursor`.

## ACP mode

`cursor-agent acp` (the ACP registry's `cursor` entry; a hidden command,
"Start the Cursor Agent as an ACP (Agent Client Protocol) server").

- No plugin: `--plugin-dir` belongs to the chat command. In the
  2026.11.11 build only the chat path turns it into plugin folders
  (`index.js`, `pluginDirPaths`); the `acp` command never passes them on.
  So ACP mode runs without our hooks: ACP itself reports the run, and
  messages wait for the run's end (an idle agent gets a waking one as a
  prompt).
- `tools: session`: for the same reason the bridge comes in session/new
  (Cursor's handshake says it takes HTTP MCP servers), not from the
  plugin's `mcp.json`.
- No `options`.
- `chat`: `--resume <chatId>` at 1 (`cursor-agent --help`).
- PC trial (2026-11-13, 2026.11.11): the handshake only; a chat needs
  sign-in. Owed: a signed-in turn, that an ACP chat's id opens with
  `--resume`, and a phone check.

## Events

The plugin's `hooks/hooks.json`: `beforeSubmitPrompt` working, `stop`
finished. Cursor has no hook for "waiting for your answer", and `stop`
fires for completed, aborted and failed runs alike.

## Messages

Other agents' messages come in through more hooks in the plugin's
`hooks/hooks.json`, `phonecando-inbox`: `postToolUse` (after each tool
that succeeds) adds them as `additional_context`, and `stop`, after a
completed run only, sends them as the next message (`followup_message`;
Cursor's `loop_limit`, 5 by default, caps those). `beforeSubmitPrompt` can
only allow or block, so there is no turn-start one. Cursor cannot be woken
when idle: messages that come then wait for the next tool call or the end
of the next run. We read both fields in `cursor-agent`'s own code
(2026.11.11-b912975), which hands them to Cursor's service; we have not
yet seen a run use them.

## Phone tools

The plugin's `mcp.json`: `${env:PHONECANDO_BRIDGE_URL}/mcp` with
`Bearer ${env:PHONECANDO_BRIDGE_TOKEN}`, which Cursor resolves from the
environment. Cursor asks you to approve the server
(`plugin-phonecando-phonecando`) the first time.

Our phone tools never ask after that, since the phone-control lock is
their check: Cursor reads per-tool trust only from `permissions.allow` in
`~/.cursor/cli-config.json` (or a project's `.cursor/cli.json`), not from a
plugin. A plugin's `beforeMCPExecution` hook cannot do it: "Returning
`allow` from a hook does not override the MCP approval system" (Cursor
staff, forum.cursor.com/t/155434). So the launch runs
`phonecando-trust.mjs` with Cursor's bundled `node` (next to the
`cursor-agent` script it links to). It adds `Mcp(phonecando:*)` and
`Mcp(plugin-phonecando-phonecando:*)` when they are missing and leaves
every other key and entry alone. Cursor matches the server part against
the server's identifier, `plugin-<plugin>-<name>` for a plugin's
(2026.11.19's `mcp-translation.js` and `matchesMcpPattern`). The script
leaves a file that does not parse alone. A missing file gets just our
entries, and Cursor fills in its other defaults on its first read (it
merges a partial file over them), though without its default
`Shell(ls)`. Cursor's own tools ask as before. ACP mode reads the same
list, but its env has no `PHONECANDO_BRIDGE_URL` (the bridge comes in
the chat), so it is not wrapped. Its permission questions about our tools
are answered by the runner.

## Local models

None: Cursor CLI talks only to Cursor's own service.

## Sign-in

Cursor polls its service for the result, so no loopback is involved.
