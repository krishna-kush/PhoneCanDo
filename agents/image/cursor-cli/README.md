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

## State

- No global instructions file we can write to.
- One Cursor CLI agent per machine: its sign-in moves only with
  `XDG_CONFIG_HOME`, which we keep for the machine.
- `userState`: `~/.cursor` and `~/.config/cursor`.

## Events

The plugin's `hooks/hooks.json`: `beforeSubmitPrompt` working, `stop`
finished. Cursor has no hook for "waiting for your answer", and `stop`
fires for completed, aborted and failed runs alike.

## Phone tools

The plugin's `mcp.json`: `${env:PHONECANDO_BRIDGE_URL}/mcp` with
`Bearer ${env:PHONECANDO_BRIDGE_TOKEN}`, which Cursor resolves from the
environment. Cursor asks you to approve the server
(`plugin-phonecando-phonecando`) the first time.

## Local models

None: Cursor CLI talks only to Cursor's own service.

## Sign-in

Cursor polls its service for the result, so no loopback is involved.
