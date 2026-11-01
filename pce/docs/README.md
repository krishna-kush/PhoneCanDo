# PCE documentation

Start with the overview, then use the section you need. The root `README.md` is
the entry point; this file is the full map.

## Overview

- `overview/architecture.md` — product boundary, mental model, dependency law,
  public API law and reuse policy.
- `overview/modules.md` — module map and links to per-module docs.
- `overview/status.md` — current release and device-proof status.

## API

- `api/README.md` — coordinates and reading order.
- `api/mental-model.md` — backend → snapshot → selector/action flow.
- `api/snapshots.md` — snapshots, node ids and staleness.
- `api/selectors.md` — selector fields and ambiguity.
- `api/actions.md` — action set and options.
- `api/backends.md` — backend contract and routing.
- `api/json.md` — optional contract JSON.
- `api/packs.md` — signed packs and flows.
- `api/lifecycle.md` — threading, lifecycle and versioning.

## Guides

- `guides/quickstart.md` — build, test, publish and sample output.
- `guides/consumer.md` — use published artifacts from another project.
- `guides/testing.md` — test layers, backend contract and device evidence.

## Modules

- `modules/api.md`, `modules/core.md`, `modules/json.md`, `modules/pack.md`,
  `modules/testkit.md`
- `modules/android.md`, `modules/ime.md`, `modules/shizuku.md`
- `modules/sample.md`, `modules/consumer-sample.md`

## Planning

- `planning/plan.md` — phase index and current slice.
- `planning/phases/` — one file per phase.
- `planning/todo.md` — open work only.
- `planning/done.md` — completed milestones.
- `planning/decisions.md` — settled architecture decisions.
- `planning/risks.md` — non-goals and risks.

## Release

- `release/release.md` — artifacts, semver and optional publishing.
- `release/migration.md` — migration notes.
- `release/changelog.md` — release notes.
- `release/known-limits.md` — cross-module limits.
