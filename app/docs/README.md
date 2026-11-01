# PhoneCanDo app docs

App, engine and agent documentation. The engine hosts one agent; opencode is
the first. Cross-cutting docs (overview, automation contract, release limits)
stay in the repo-root `docs/` tree.

## Start here

- [`guides/quickstart.md`](guides/quickstart.md) — install, build and first boot.
- [`guides/development.md`](guides/development.md) — dev loop and verification.
- [`context.md`](context.md) — project context and hard-won platform notes.

## Modules

- [`modules/runner.md`](modules/runner.md) — engine host, serve service and
  notifications.
- [`modules/terminal.md`](modules/terminal.md) — JNI PTY, xterm renderer and
  input/sizing contract.
- [`modules/chat.md`](modules/chat.md) — pair-loaded opencode web UI.
- [`modules/bridge.md`](modules/bridge.md) — loopback bridge, `mobile_*` tools,
  trust gate and flavors.
- [`modules/automation.md`](modules/automation.md) — PCE host integration, routes
  and current status.

## Related

- [`../../docs/README.md`](../../docs/README.md) — repo docs map, architecture,
  automation contract and release limits.
- [`../../pce/docs/README.md`](../../pce/docs/README.md) — PCE library docs.
