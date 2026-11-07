# PhoneCanDo documentation

Repo-level docs plus the app docs tree. Start with the overview, then use the
section you need. App implementation docs live in `app/docs/`; the PCE has its
own tree at `pce/docs/README.md`, and so has the Linux runtime at
`lre/docs/README.md` (how it fits the app: `overview/architecture.md`).

## Start here

1. `overview/architecture.md` — how the app, agents, engines, Linux images and
   native layers fit.
2. `overview/modules.md` — where each subsystem lives.
3. `app/docs/guides/quickstart.md` — install, build and first boot.
4. `app/docs/guides/development.md` — build/reload loop and verification.
5. `app/docs/modules/runner.md`, `app/docs/modules/terminal.md`,
   `app/docs/modules/chat.md` — the core runtime and UI pieces.
6. `api/README.md` — only when touching phone control or the agent tools.

## Overview

- `overview/architecture.md` — product shape, agents and engines, envs and
  images (the Linux runtime), boundaries and repo map.
- `overview/modules.md` — subsystem map and links to module docs.
- `overview/status.md` — current engine, Linux, automation and device-proof
  status.

## Automation contract (v1, host-facing)

This is the AI/host contract (`mobile_*` tools and `/pce/*` JSON), not the PCE
Kotlin library API. The library API is in `pce/docs/api/`.

- `api/README.md` — coordinates and reading order.
- `api/mental-model.md` — layers, update speeds and why the contract is
  updatable.
- `api/tools.md` — AI-facing `mobile_*` tool surface.
- `api/snapshots.md` — observation payloads, node ids and screenshot rules.
- `api/selectors.md` — selector fields and resolution order.
- `api/actions.md` — action registry and risk levels.
- `api/errors.md` — error codes and recovery hints.
- `api/packs.md` — pack format, manifests and signing.
- `api/backends.md` — backend contract, v1 routing and future Shizuku work.
- `api/security.md` — trust gate, allowlists, redaction and audit.

## App docs

- `app/docs/README.md` — app docs index.
- `app/docs/guides/quickstart.md` — install, build and first boot.
- `app/docs/guides/development.md` — dev loop, stale-JS rule and verification.
- `app/docs/modules/runner.md` — `phonecando-runner`: agents, several engines
  at once, the foreground service, opencode payload, config seeding and
  telemetry counters.
- `app/docs/modules/terminal.md` — `phonecando-terminal`: JNI PTY, xterm
  renderer, input/sizing contract and terminal sessions.
- `app/docs/modules/chat.md` — the active agent's pair-loaded web UI in the
  app shell.
- `app/docs/modules/bridge.md` — loopback bridge, per-agent tokens, prompts,
  screen lease, `mobile_*` tools, trust gate and full/lite/play channels.
- `app/docs/modules/automation.md` — PCE host integration, routes, pack
  lifecycle and current implementation status.
- `app/docs/context.md` — project context and hard-won platform notes,
  Linux images included.

## Telemetry

- `telemetry.md` — the published schema: every field the app and site send,
  retention, storage, controls and every outbound network call.
- `../tce/README.md` — the Telemetry Collection Engine (backend, client SDK,
  Cloudflare Worker); rules in `../tce/AGENTS.md`, open work in
  `../tce/docs/planning/todo.md`.

## Guides

- `guides/testing.md` — app and Linux runtime checks, CI workflows and
  automation test layers.

## Planning

- `planning/automation.md` — automation phases, non-goals and cross-product
  roadmap.
- `research/` — background notes and open questions.

## Release

- `../manage` — root entry point for every script (`./manage help`).
- `release/upgrade-test.md` — on-device test: can lite install full past
  Play Protect, and which install method gets through.
- `release/known-limits.md` — cross-module limits and not-yet features.
- `release/android.md` — signed APK releases, keys, versionCode and the
  in-app updater.
- `pce/docs/release/known-limits.md` — PCE-internal limits.

## Related trees

- `pce/docs/README.md` — the PCE product and API docs.
- `tce/README.md`, `tce/AGENTS.md` — the telemetry backend and its rules.
- `docs/bootstrap/README.md`, `docs/bootstrap/oc-build.md`,
  `scripts/agents/oc/` — native payload build.
- `lre/README.md`, `lre/AGENTS.md`, `lre/docs/README.md` — the Linux
  runtime engine: Gradle modules, the launcher (`lre/launcher/src/conf.h`
  is the launch.conf contract), the proot build and the Default image
  (`./manage image`); open work in `lre/docs/planning/todo.md`. How it
  fits the app: `overview/architecture.md`.
- `web/README.md` — the site (static Astro, served by the `tce/` Worker).
- `AGENTS.md` — coding rules and quality gates.

Local reference clones live in `reference/` (gitignored); they are not part of
this tree.
