# Bootstrap — build the opencode payload

The app ships ~200 MB of native opencode payload that is not in git:
`liboc-engine.so` (the engine, Bun) and `liboc-opentui.so` (the TUI
renderer, Zig), both bionic aarch64. The app build does **not** build it:
run `./manage agent opencode build|stage` first (it stages into
`app/modules/phonecando-runner/android/src/agents/opencode/libs/arm64-v8a/`),
then build the app. Steps, patches, checks and version bumps: `build.md`.

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
