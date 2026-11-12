# copilot-cli

GitHub Copilot CLI, installed with GitHub's installer and run as a TUI in
the agent's machine. Shared image-kind rules: `agents/AGENTS.md` §4.

## Install

- The binary links OpenSSL 3, so each family gets its OpenSSL libraries.
- The installer runs with `PREFIX=$HOME/.local` and `~/.local/bin` already
  on PATH, so it never offers to edit a shell profile.
- No Alpine: the installer always takes the glibc build. GitHub's musl
  build ships only on npm (`@github/copilot-linuxmusl-arm64`).

## Launch

- `resume` adds `--continue`: the newest chat for the folder, else the
  newest anywhere.
- No `chatTitle` yet: the window title is `<chat title> - <intent> -
  GitHub Copilot`, or `GitHub Copilot`, and we have not seen a signed-in
  one.

## State

- Global instructions: `~/.copilot/copilot-instructions.md`.
- A second Copilot CLI agent on the machine keeps its state in its own
  folder (`COPILOT_HOME`); the runner seeds our hooks into its
  `copilot/hooks`.
- `userState`: `~/.copilot`.

## Events

- Hooks: the runner seeds `config/phonecando.json` into `~/.copilot/hooks/`
  on every start, beside your own hook files, which Copilot merges.
  `userPromptSubmitted` working, `permissionRequest` waiting, `agentStop`
  finished, `errorOccurred` failed.
- OSC 7501 and, per its docs, OSC 9;4 progress: `working`, `blocked`,
  `done` and `error` map as usual. `idle` stays unmapped: Copilot's source
  is closed, and we don't know yet when it says it.

## Phone tools

`--additional-mcp-config`, a `when: bridgeUrl` item, for this run only, so
`~/.copilot/mcp-config.json` stays yours. The URL is `{{bridgeUrl}}/mcp`
because Copilot rejects a `${…}` in an MCP `url` (and exits). The header
stays `Bearer ${PHONECANDO_BRIDGE_TOKEN}`, which Copilot expands.

## Local models

None: Copilot CLI takes a model server only from its own config.

## Sign-in

With no keychain in the machine, Copilot keeps its token in plain text in
`~/.copilot/` (it asks first).
