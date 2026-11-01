# PhoneCanDo documentation

Repo-level docs plus the app docs tree. Start with the overview, then use the
section you need. App implementation docs live in `app/docs/`; the PCE has its
own tree at `pce/docs/README.md`.

## Start here

1. `overview/architecture.md` — how the app, engine and native layers fit.
2. `overview/modules.md` — where each subsystem lives.
3. `app/docs/guides/quickstart.md` — install, build and first boot.
4. `app/docs/guides/development.md` — build/reload loop and verification.
5. `app/docs/modules/runner.md`, `app/docs/modules/terminal.md`,
   `app/docs/modules/chat.md` — the core runtime and UI pieces.
6. `api/README.md` — only when touching phone control or the agent tools.

## Overview

- `overview/architecture.md` — product shape, boundaries, repo map and data
  flow.
- `overview/modules.md` — subsystem map and links to module docs.
- `overview/status.md` — current engine, automation and device-proof status.

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
- `app/docs/modules/runner.md` — `phonecando-runner`: opencode payload, serve
  service and notifications.
- `app/docs/modules/terminal.md` — `phonecando-terminal`: JNI PTY, xterm
  renderer and input/sizing contract.
- `app/docs/modules/chat.md` — pair-loaded opencode web UI in the app shell.
- `app/docs/modules/bridge.md` — loopback bridge, `mobile_*` tools, trust gate
  and full/play flavors.
- `app/docs/modules/automation.md` — PCE host integration, routes, pack
  lifecycle and current implementation status.
- `app/docs/context.md` — project context and hard-won platform notes.

## Guides

- `guides/testing.md` — app checks, automation test layers and telemetry.

## Planning

- `planning/automation.md` — automation phases, non-goals and cross-product
  roadmap.
- `research/` — background notes and open questions.

## Release

- `release/known-limits.md` — cross-module limits and not-yet features.
- `release/android.md` — signed APK releases, keys, versionCode and the
  in-app updater.
- `pce/docs/release/known-limits.md` — PCE-internal limits.

## Related trees

- `pce/docs/README.md` — the PCE product and API docs.
- `docs/bootstrap/README.md`, `docs/bootstrap/oc-build.md`,
  `scripts/bootstrap/` — native payload build.
- `web/README.md` — marketing site.
- `AGENTS.md` — coding rules and quality gates.

Local reference clones live in `reference/` (gitignored); they are not part of
this tree.
