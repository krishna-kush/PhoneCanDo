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

- [`modules/runner.md`](modules/runner.md) — engine host: agents and kinds,
  engines (server or TUI), installs, the local model servers, run limits
  and the memory guard, the foreground service, notifications and
  telemetry counters.
- [`modules/terminal.md`](modules/terminal.md) — JNI PTY, xterm renderer,
  input/sizing contract and terminal sessions (agent TUI or image shell).
- [`modules/chat.md`](modules/chat.md) — Home: the active agent's web UI or
  TUI, the navigation around it (page stack, drawer, Back) and the RAM
  warning over it.
- [`modules/models.md`](modules/models.md) — local models: files, Hugging
  Face, downloads and imports, RAM verdicts, context and the token.
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
