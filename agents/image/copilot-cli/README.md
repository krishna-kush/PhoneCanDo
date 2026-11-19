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
- `prompt` (a scheduled task) appends `-i <task>`, after `--continue`:
  "Start an interactive session and automatically execute this prompt"
  (docs.github.com, Copilot CLI command reference; 1.0.107's changelog
  lets `--continue` send it). From the docs only: the binary's parser is
  not readable.
- No `chatTitle` yet: the window title is `<chat title> - <intent> -
  GitHub Copilot`, or `GitHub Copilot`, and we have not seen a signed-in
  one.

## State

- Global instructions: `~/.copilot/copilot-instructions.md`.
- A second Copilot CLI agent on the machine keeps its state in its own
  folder (`COPILOT_HOME`); the runner seeds our hooks into its
  `copilot/hooks`.
- `userState`: `~/.copilot`.

## ACP mode

`copilot --acp --no-auto-update` (the ACP registry's `github-copilot-cli`
entry; "Start as Agent Client Protocol server" in `copilot --help`,
1.0.110). `--no-auto-update` as in the launch.

- `tools: session`: terminal mode adds the bridge in argv
  (`--additional-mcp-config`); in ACP mode the runner hands it over in
  session/new, which Copilot's handshake says takes HTTP MCP servers.
- No `options`.
- `chat`: `--resume <id>`, appended as `resume` is ("optionally specify
  existing session ID").
- Our hooks sit in Copilot's own hooks folder, so they should run in ACP
  mode too.
- PC trial (2026-11-13, 1.0.110): the handshake only; a chat needs
  sign-in. Owed: a signed-in turn, the hooks in ACP mode, that an ACP
  chat's id opens with `--resume`, and a phone check.

## Events

- Hooks: the runner seeds `config/phonecando.json` into `~/.copilot/hooks/`
  on every start, beside your own hook files, which Copilot merges.
  `userPromptSubmitted` working, `permissionRequest` waiting, `agentStop`
  finished, `errorOccurred` failed.
- OSC 7501 and, per its docs, OSC 9;4 progress: `working`, `blocked`,
  `done` and `error` map as usual. `idle` stays unmapped: Copilot's source
  is closed, and we don't know yet when it says it.

## Messages

Other agents' messages come in through more hooks in the same file,
`phonecando-inbox`: `postToolUse` (after each tool that succeeds) adds
them as `additionalContext`, and `agentStop` keeps the turn going once
with them as its prompt (`decision: "block"`; skipped when
`stop_hook_active`, so at most once a turn, under Copilot's own cap of
8). There is no turn-start one: Copilot drops what a
`userPromptSubmitted` command hook prints. Copilot cannot be woken when
idle: messages that come then wait for the next tool call or the end of
the next turn. Copilot cuts `additionalContext` at 10 KB.

## Phone tools

`--additional-mcp-config`, a `when: bridgeUrl` item, for this run only, so
`~/.copilot/mcp-config.json` stays yours. The URL is `{{bridgeUrl}}/mcp`
because Copilot rejects a `${…}` in an MCP `url` (and exits). The header
stays `Bearer ${PHONECANDO_BRIDGE_TOKEN}`, which Copilot expands.

Our phone tools never ask, since the phone-control lock is their check:
the same item adds `--allow-tool=phonecando`, "Allow all tools from a
server" (Copilot CLI command reference, Tool permission patterns; 1.0.114),
which trusts only our server, never shell, write or another server.

## Local models

None: Copilot CLI takes a model server only from its own config.

## Sign-in

With no keychain in the machine, Copilot keeps its token in plain text in
`~/.copilot/` (it asks first).
