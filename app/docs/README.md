# PhoneCanDo app docs

App, engine and agent documentation. An engine hosts one agent, and several
agents run at once, each in its own image or sharing one with other agents;
opencode is the first kind.
Cross-cutting docs (overview, the Linux runtime, automation contract, release
limits) stay in the repo-root `docs/` tree.

## Start here

- [`guides/quickstart.md`](guides/quickstart.md) — install, build and first boot.
- [`guides/development.md`](guides/development.md) — dev loop and verification.
- [`context.md`](context.md) — project context and hard-won platform notes,
  Linux images included.

## Modules

- [`modules/runner.md`](modules/runner.md) — engine host: agents and kinds,
  engines (server or TUI, and ACP mode), installs, the local model servers
  (their measured memory, chats on storage), run limits and the memory
  guard, the foreground service, notifications, messages, schedules,
  cut-off runs, checks and telemetry counters.
- [`modules/terminal.md`](modules/terminal.md) — JNI PTY, xterm renderer,
  input/sizing contract and terminal sessions (agent TUI or image shell).
- [`modules/chat.md`](modules/chat.md) — Home: the active agent's web UI or
  TUI, the navigation around it (page stack, drawer, Back), the RAM
  warning over it and the agents' messages page.
- [`modules/models.md`](modules/models.md) — local models: files, Hugging
  Face, downloads and imports, RAM verdicts, context and the Memory
  setting, and the token.
- [`modules/bridge.md`](modules/bridge.md) — loopback bridge, per-agent tokens,
  prompts, screen lease, `mobile_*` tools, trust gate and flavors.
- [`modules/automation.md`](modules/automation.md) — PCE host integration, routes
  and current status.

## Testing

- [`../../phone-tests/README.md`](../../phone-tests/README.md) — phone tests
  (repo root): what has been tried on a real phone, on which build and
  agents, and what is not tested yet (run by an AI tester so far: read its
  warning first), and how to start a new round. Latest results:
  [`../../phone-tests/status.md`](../../phone-tests/status.md).

## Related

- [`../../docs/README.md`](../../docs/README.md) — repo docs map, architecture,
  automation contract and release limits.
- [`../../docs/overview/architecture.md`](../../docs/overview/architecture.md)
  — envs, images and the Linux runtime (`lre/`, `phonecando-linux`).
- [`../../pce/docs/README.md`](../../pce/docs/README.md) — PCE library docs.
