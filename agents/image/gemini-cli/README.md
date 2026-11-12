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
- No `chatTitle`: the window title is only the state and the folder.

## State

- Global instructions: `~/.gemini/GEMINI.md`.
- A second Gemini CLI agent on the machine keeps its `.gemini` in its own
  folder (`GEMINI_CLI_HOME`), with `GEMINI_FORCE_FILE_STORAGE=true` so its
  sign-in is a file there, not a keychain entry. Our system settings
  (`GEMINI_CLI_SYSTEM_SETTINGS_PATH`) stay one file for both.
- `userState`: `~/.gemini`.

## Events

Hooks: `BeforeAgent` working, `Notification` (a tool waits for your
approval) waiting, `AfterAgent` finished. The hook prints nothing and
never exits 2, which would block the turn.

- An API error still ends with `AfterAgent` (finished, not failed).
- Esc fires nothing, so the runner's stale-run rule ends the run.
- The quota and model-fallback dialogs fire no hook.
- Gemini briefly shows `Executing Hook: phonecando-working`; no setting
  hides hooks that come from settings files.

## Phone tools

`mcpServers.phonecando`: `httpUrl` `${PHONECANDO_BRIDGE_URL}/mcp` with
`Bearer ${PHONECANDO_BRIDGE_TOKEN}`, expanded when Gemini loads settings.
Each phone tool asks for approval like any tool.

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
