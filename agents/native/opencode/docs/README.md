# Bootstrap — build the opencode payload

The app ships ~200 MB of native opencode payload that is not in git:
`liboc-engine.so` (the engine, Bun) and `liboc-opentui.so` (the TUI
renderer, Zig), both bionic aarch64. The app build does **not** build it:
run `./manage agent opencode build|stage` first (it stages into
`app/modules/phonecando-runner/android/src/agents/opencode/libs/arm64-v8a/`),
then build the app. Steps, patches, checks and version bumps: `build.md`.
Pinned in `../build/pins.env`: `--branch v2.0.26`, Bun 1.4.2, NDK r28c,
Zig 0.16 (`ci/pins.sh` checks this line and `build.md` name the same).

We build from upstream sources, so opencode stays current and carries the
embedded web UI and pair API the Home tab needs.

## Plugins (opencode v2)

v2 loads `plugins/<id>/index.ts` (`@opencode/plugin`, `Plugin.define` +
`ctx.tool.transform`) from the global config dir and from
`<project>/.opencode/plugins/`; v1 `tools/*.ts` and `@opencode-ai/plugin`
do not load. Our phone tools ship as such plugins (`../config/plugins/`).

## Local models

Over `openai-chat`: the `models` block adds a `phonecando-local` provider
through `OPENCODE_CONFIG_CONTENT`, its key from `LOCAL_MODEL_KEY`. CI's
local-model check runs `run --standalone` (a private server, not the
background service; `../one-shot.json`) with upstream's Linux build of our
pinned tag (`../ci/host-engine.sh`).

## State

- Global instructions: `~/.config/opencode/AGENTS.md`, shipped in our
  config (`config/AGENTS.md`, `config-lite/` on lite and play).
- A second opencode agent on the machine gets its own config folder
  (`OPENCODE_CONFIG_DIR`, which replaces `~/.config/opencode`; the runner
  seeds our config there) and its own database (`OPENCODE_DB`: sign-in,
  chats and settings). Still shared with the first: `~/.local/state/opencode`
  (the TUI's prompt history, model choice and last chat; the persistent
  terminals' daemon; locks) and the rest of `~/.local/share/opencode`
  (logs, worktrees, repos).
- `userState`: `~/.config/opencode`, the database files and the TUI's
  state files, not those two folders whole: the other agent still uses
  them, and the data folder holds worktrees.
