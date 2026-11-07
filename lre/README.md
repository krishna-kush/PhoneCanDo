# PhoneCanDo LRE

The Linux runtime engine (LRE) turns a fixed base OS into a VM-like Linux
image that runs under proot on an Android phone, one image per agent.
PhoneCanDo owns the roadmap and is the only consumer: its full and lite
channels run every Linux image through it; play ships no Linux.

Status: `0.1.0-dev`, pre-release. The app builds the JVM modules from source
through a Gradle composite build (`app/plugins/withLreCompositeBuild.js`),
compiles the launcher with CMake and packages the staged proot build and the
Default image (`app/modules/phonecando-linux/`). proot, the launcher, an
Alpine image and the baked Default image (staged locally in a debug build)
are device-proven on Android 16; `images/default/lock.json` locks no image
yet. Open work is tracked in `docs/planning/todo.md`.

What lives here:

- `api/`, `tar/`, `oci/`, `image/`, `cli/` — the pure-JVM Gradle modules
  (`settings.gradle.kts`).
- `launcher/` — our C launcher every guest command goes through;
  `launcher/src/conf.h` is the `launch.conf` contract.
- `proot/` — build scripts for the pinned termux/proot fork (MIT,
  `proot/LICENSE`; proot itself is GPL-2.0-or-later).
- `images/default/` — the Default image build and `lock.json`, the image
  the APK ships.

## Start here

- `docs/README.md` — full documentation map.
- `docs/overview/architecture.md` — product boundary, mental model, on-disk
  layout, how a command runs and dependency law.
- `docs/overview/modules.md` — module map and module docs.
- `docs/guides/quickstart.md` — build, test and run an image locally.
- `docs/guides/images.md` — build, lock, fetch and stage the Default image.
- `docs/planning/todo.md` — current open work.
- `docs/release/known-limits.md` — known limits.

## Rules

`AGENTS.md` is the quality gate for the product boundary, dependency law,
typed errors, on-disk contracts, the launcher, proot, the Default image,
licences, testing and CI. Read it before changing `lre/`.

## Docs

All LRE documentation lives under `docs/`. `README.md` and `AGENTS.md` are
the only Markdown files at the LRE root.
