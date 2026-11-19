# gemini-cli

Google's Gemini CLI, installed from npm on our `node` runtime and run as a
TUI in the agent's machine. Shared image-kind rules: `agents/AGENTS.md` §4.

## Install

- `bash` (Gemini runs its shell tool and hooks with it) and `ripgrep`
  (the npm package ships no `rg`).
- No compiler needed: keytar carries its own arm64 and musl builds,
  `@lydell/node-pty` has a glibc one, and npm drops `node-pty`. Without a
  PTY module (Alpine) Gemini runs shell commands without one.
- `versionCheck` takes the first line that starts with a version, so a
  Node warning above it does no harm.

## Launch

`GEMINI_CLI_SYSTEM_SETTINGS_PATH` points at our `config/settings.json`,
seeded to `/root/.phonecando/gemini/`. System settings win over user and
project ones, and `mcpServers` and `hooks` merge across them, so
`~/.gemini/settings.json` stays yours.

- Gemini reads a system settings file only when the file and every folder
  above it are owned by root and not writable by group or others;
  otherwise it shows `Skipping system settings file` and runs without our
  hooks and tools. proot's fake root shows our files as root's. If it
  ever happens, `stat -c '%u %a %n' / /root /root/.phonecando
  /root/.phonecando/gemini` shows which folder is wrong.
- `general.enableAutoUpdate` off: Gemini's own update would run a plain
  `npm install -g` into Node's prefix, not `~/.local`.
- The first output may take 180 s: Gemini starts a second Node (a child
  with a larger heap) under proot. That child restarts after a trust
  change while the parent stays, so the engine lives on
  (`GEMINI_CLI_NO_RELAUNCH` stays unset).
- `resume` adds `--resume latest`; with no saved chat Gemini starts a new
  one.
- No `prompt`, so the TUI takes no scheduled task (ACP mode runs them,
  below): `-i/--prompt-interactive` starts a new chat with a first
  prompt, but with `--resume latest` (0.68.0) it sends the prompt before
  the old chat has loaded, so the model never sees that chat and the turn
  is not saved to it (`ui/AppContainer.tsx` does not wait for
  `useSessionResume`).
- No `chatTitle`: the window title is only the state and the folder.

## State

- Global instructions: `~/.gemini/GEMINI.md`.
- A second Gemini CLI agent on the machine keeps its `.gemini` in its own
  folder (`GEMINI_CLI_HOME`), with `GEMINI_FORCE_FILE_STORAGE=true` so its
  sign-in is a file there, not a keychain entry. Our system settings
  (`GEMINI_CLI_SYSTEM_SETTINGS_PATH`) stay one file for both.
- `userState`: `~/.gemini`.

## ACP mode

`gemini --acp` (the ACP registry's `gemini` entry; "Starts the agent in
ACP mode" in `gemini --help`, 0.68.0).

- `tools: config`: ACP mode reads the same settings
  (`GEMINI_CLI_SYSTEM_SETTINGS_PATH`), which name the bridge and our
  hooks, so the runner adds no server in session/new. The folder's trust
  (Notes) counts here too.
- No `options`: its ACP chats start in `default`, which asks before a
  tool runs.
- `chat`: `--resume <id>` at 1. Gemini takes a chat's id there as well as
  `latest` or a number, and an ACP chat is saved under its ACP id (0.68.0:
  the ACP `newSession` makes the id and the session's config uses it).
  It keeps no chat it never answered in: a failed turn is taken back, its
  start deletes chat files left empty (`general.sessionRetention`, on by
  default), `--resume <id>` of one exits 42 and `session/load` of one
  answers "Internal error" (why in `data.details`). So the runner keeps a
  new ACP chat only once a turn in it was answered.
- In a folder it doesn't trust, ACP mode skips the trust check (0.68.0:
  the trust dialog and its headless exit 55 are the TUI's and `-p`'s) and
  runs with no hooks and no MCP servers, asking nothing: the check marks
  ACP phone tools Not working; trust the folder in its own app.
- So Gemini can run scheduled tasks, and an idle agent in ACP mode gets a
  waking message as a prompt.
- PC trial (2026-11-13, 0.68.0): the handshake only; a chat needs sign-in.
  Owed: a signed-in turn, our hooks in ACP mode, and a phone check.

## Events

Hooks: `BeforeAgent` working, `Notification` (a tool waits for your
approval) waiting, `AfterAgent` finished. The hook prints nothing and
never exits 2, which would block the turn.

- An API error still ends with `AfterAgent` (finished, not failed).
- Esc fires nothing, so the runner's stale-run rule ends the run.
- The quota and model-fallback dialogs fire no hook.
- Gemini briefly shows `Executing Hook: phonecando-working`; no setting
  hides hooks that come from settings files.

## Messages

Other agents' messages come in through more hooks in the same file,
`phonecando-inbox`: `BeforeAgent` (turn start) and `AfterTool` (after
each tool) add them as `hookSpecificOutput.additionalContext`, and
`AfterAgent` sends them back as the next prompt once (`decision: "deny"`
with the messages as `reason`; skipped when `stop_hook_active`, so at most
once a turn). Gemini cannot be woken when idle: messages that come then
wait for the next turn.

- Gemini wraps hook context in `<hook_context>` and escapes `<` and `>`
  in it, so the model reads `&lt;agent-message …&gt;`.
- The `AfterAgent` continuation shows as `Agent execution blocked:
  messages from other agents arrived, so Gemini goes on with them`, and
  the run reads finished, then working again.
- `Executing Hook: phonecando-inbox` shows after every tool.

## Phone tools

`mcpServers.phonecando`: `httpUrl` `${PHONECANDO_BRIDGE_URL}/mcp` with
`Bearer ${PHONECANDO_BRIDGE_TOKEN}`, expanded when Gemini loads settings.
`trust: true` on that server only, so our phone tools never ask: the
phone-control lock is their check (0.69.0: a settings rule allowing
`mcp_phonecando_*`, in every mode but plan). Gemini's own tools still ask
as its settings say. Trust counts only in a trusted folder (Notes).

## Local models

None: Gemini CLI speaks only Google's Gemini API.

## Sign-in

A free API key has no `gemini-3.1-pro-preview`, which `Auto` uses for
main requests: pick Flash in `/model`, or add `GEMINI_MODEL=flash` to
`~/.gemini/.env`.

## Notes

On first start, pick `Trust folder`. An untrusted folder runs no hooks and
no MCP servers from any settings file, so there are no events and no phone
tools.
