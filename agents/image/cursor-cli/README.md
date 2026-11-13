# cursor-cli

Anysphere's Cursor CLI (`cursor-agent`), installed with Cursor's installer
and run as a TUI in the agent's machine. Shared image-kind rules:
`agents/AGENTS.md` §4.

## Install

No Alpine: Cursor builds only for glibc (its bundled Node does not run on
musl).

## Launch

- `cursor-agent`, not `agent`, which another CLI also installs.
- `--plugin-dir /root/.phonecando/cursor`: the runner seeds `config/`
  there, a Cursor plugin (`.cursor-plugin/plugin.json`) loaded for this
  run only, so `~/.cursor/` stays yours.
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

## Local models

None: Cursor CLI talks only to Cursor's own service.

## Sign-in

Cursor polls its service for the result, so no loopback is involved.
