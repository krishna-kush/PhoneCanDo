# Bootstrap — build the opencode payload

The app ships ~200 MB of native opencode payload that is not in git:
`liboc-engine.so` (the engine, Bun) and `liboc-opentui.so` (the TUI
renderer, Zig), both bionic aarch64. The app build does **not** build it:
build and stage it first (`./manage agent opencode build|stage`, which
stages into
`app/modules/phonecando-runner/android/src/agents/opencode/libs/arm64-v8a/`),
then build the app. Steps, patches, checks and version bumps: `build.md`.

We build from upstream sources, so opencode stays current and carries the
embedded web UI and pair API the Home tab needs; no prebuilt runtime is
involved.

## Plugins (opencode v2)

v2 loads `plugins/<id>/index.ts` (`@opencode/plugin`, `Plugin.define` +
`ctx.tool.transform`) from the global config dir and from
`<project>/.opencode/plugins/`; v1 `tools/*.ts` and `@opencode-ai/plugin`
do not load (checked on the phone). Our phone tools ship as such plugins
(`../config/plugins/`).
