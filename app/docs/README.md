# PhoneCanDo app docs

App, engine and agent documentation. An engine hosts one agent, and several
agents run at once, each in its own image; opencode is the first kind.
Cross-cutting docs (overview, the Linux runtime, automation contract, release
limits) stay in the repo-root `docs/` tree.

## Start here

- [`guides/quickstart.md`](guides/quickstart.md) — install, build and first boot.
- [`guides/development.md`](guides/development.md) — dev loop and verification.
- [`context.md`](context.md) — project context and hard-won platform notes,
  Linux images included.

## Modules

- [`modules/runner.md`](modules/runner.md) — engine host: agents, several
  engines at once, the foreground service, config seeding and telemetry
  counters.
- [`modules/terminal.md`](modules/terminal.md) — JNI PTY, xterm renderer,
  input/sizing contract and terminal sessions (agent TUI or image shell).
- [`modules/chat.md`](modules/chat.md) — the active agent's pair-loaded web
  UI and the agent switcher.
- [`modules/bridge.md`](modules/bridge.md) — loopback bridge, per-agent tokens,
  prompts, screen lease, `mobile_*` tools, trust gate and flavors.
- [`modules/automation.md`](modules/automation.md) — PCE host integration, routes
  and current status.

## Related

- [`../../docs/README.md`](../../docs/README.md) — repo docs map, architecture,
  automation contract and release limits.
- [`../../docs/overview/architecture.md`](../../docs/overview/architecture.md)
  — envs, images and the Linux runtime (`lre/`, `phonecando-linux`).
- [`../../pce/docs/README.md`](../../pce/docs/README.md) — PCE library docs.
