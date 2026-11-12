# qwen-code

The Qwen team's Qwen Code, installed from npm on our `node` runtime and
run as a TUI in the agent's machine. Shared image-kind rules:
`agents/AGENTS.md` §4.

## Install

On Alpine the native extras (`@lydell/node-pty`, the clipboard module)
have glibc builds only, so Qwen runs shell commands without a PTY there.

## Launch

`QWEN_CODE_SYSTEM_SETTINGS_PATH` points at our `config/settings.json`,
seeded to `/root/.phonecando/qwen/`. System settings win over user and
project ones, and `mcpServers` and `hooks` merge across them, so
`~/.qwen/settings.json` stays yours. Unlike Gemini CLI, Qwen runs hooks
from system settings whatever the folder's trust.

- `general.enableAutoUpdate` off: Qwen's own update installs into
  `~/.qwen/updates`.
- `resume` adds `--continue`; with no saved chat for the folder Qwen
  starts a new one.
- The window title is `Qwen - <folder>` until the chat has a name, then
  the name, with a state glyph in front, padded to 80 columns;
  `surfaces.chatTitle` takes the name and skips the default.

## State

- Global instructions: `~/.qwen/QWEN.md`.
- A second Qwen Code agent on the machine keeps its state in its own
  folder (`QWEN_HOME`), its sign-in in a file there
  (`QWEN_CODE_FORCE_FILE_STORAGE=true`). Our system settings stay one file
  for both.
- `userState`: `~/.qwen`.

## Events

- Hooks (Claude Code's names): `UserPromptSubmit` working (it fires before
  each model call of a turn, not just the first), `PermissionRequest`
  waiting, `Stop` finished, `StopFailure` (an API error or a loop ended
  the turn) failed.
- OSC 7501, unprompted; the usual map. It adds the sign-in wait and the
  cancel, which no hook reports. Its own notifications go out only while
  the terminal reports it is not focused.

## Phone tools

`mcpServers.phonecando`: `httpUrl` `${PHONECANDO_BRIDGE_URL}/mcp` with
`Bearer ${PHONECANDO_BRIDGE_TOKEN}`, expanded when Qwen loads settings.
While the server can't be reached Qwen shows `1 MCP offline`, and the
first start waits on it for a while.

## Local models

Over `openai-chat`: `--auth-type openai` and `OPENAI_BASE_URL`,
`OPENAI_API_KEY`, `OPENAI_MODEL`.

- `QWEN_CODE_API_TIMEOUT_MS=0` and `QWEN_STREAM_IDLE_TIMEOUT_MS=0`: a phone
  reads a cold 10k-token prompt for minutes before the first token, and
  with the 2 min timeout Qwen gives up and sends it again.
- Qwen reads a context size only from settings, so
  `QWEN_CODE_SYSTEM_DEFAULTS_PATH` points at `config/local-model.json`
  (its lowest layer) with `contextWindowSize` 16384, the least our server
  gives. Without it Qwen assumes 262k and never compacts before the
  server's limit.
