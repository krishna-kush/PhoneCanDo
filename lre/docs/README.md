# LRE documentation

Start with the overview, then use the section you need. The LRE root
`README.md` is the entry point and `AGENTS.md` holds the rules; this file is
the full map.

## Overview

- `overview/architecture.md` — product boundary, mental model (env → image
  → agent), on-disk layout, how a command runs, the image lifecycle,
  background processes and dependency law.
- `overview/modules.md` — module map and links to per-module docs.

## Guides

- `guides/quickstart.md` — build and test locally, run an image on an
  arm64 Linux host, and how the app pulls `lre/` in.
- `guides/testing.md` — test layers, CI workflows and their tiers, device
  evidence.
- `guides/images.md` — build, publish, lock, fetch and stage the Default
  image; GPL sources; the debug-only local image.

## Modules

- `modules/api.md`, `modules/tar.md`, `modules/oci.md`,
  `modules/image.md`, `modules/cli.md` — the Gradle modules.
- `modules/launcher.md` — the C launcher and the `launch.conf` contract.
- `modules/proot.md` — the pinned proot build, verify, stage and its GPL
  source tarball.
- `modules/default-image.md` — what the Default image is and how its build
  works.

## Planning

- `planning/decisions.md` — settled decisions, one line of reason each.
- `planning/todo.md` — open work only.

## Release

- `release/known-limits.md` — limits of the runtime, registries, setup and
  the Default image.

## Elsewhere

- `../../docs/overview/architecture.md` → Linux runtime — how the runtime
  fits the app (envs, images, agents, JS flows and screens).
- `../../app/docs/context.md` → Linux images — device-verified platform
  notes (exec from the native-library dir, data-dir spellings, 16 KB pages,
  stored assets).
- `../../docs/guides/testing.md` — every CI workflow of the repo.
- `../../THIRD_PARTY_NOTICES.md` — proot, talloc, XZ for Java and the
  Default image's licences.
