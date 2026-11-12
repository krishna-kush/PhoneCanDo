# Modules

| Module | Output | Kind | Depends on | Purpose | Docs |
|---|---|---|---|---|---|
| `api` | `lre-api` | JVM | `network-http` | Shared types, `ImageLayout`, `LreException` (and network's errors mapped to it); progress and cancel are network's. | `../modules/api.md` |
| `tar` | `lre-tar` | JVM | `api`, XZ for Java | Safe tar unpacking (plain, gzip, xz) with OCI whiteouts. | `../modules/tar.md` |
| `oci` | `lre-oci` | JVM | `api`, `network-download`, `network-retry`, kotlinx-serialization-json | Registry client (linux/arm64, verified blobs, mirrors) and the Docker Hub catalog. | `../modules/oci.md` |
| `image` | `lre-image` | JVM | `api`, `tar` | Setup, per-start refresh, reset, delete; every `run/` file. | `../modules/image.md` |
| `cli` | not published | JVM app | `oci`, `image`, kotlinx-serialization-json | The phone's download and setup on a plain JVM, for CI. | `../modules/cli.md` |
| `launcher/` | `libphonecando_launch.so` | C | — | Multi-call launcher: reads `launch.conf`, runs proot and stands in for the command. | `../modules/launcher.md` |
| `proot/` | `libproot.so`, `libproot-loader.so` | shell build | pinned termux/proot, talloc | Reproducible proot build, ELF checks, staging, GPL source tarball. | `../modules/proot.md` |
| `images/default/` | `phonecando-linux-default-<version>-arm64.tar.xz` | docker build | pinned `debian:trixie`, snapshot.debian.org | The Default env image and `lock.json`. | `../modules/default-image.md` |

The four library modules publish as `com.phonecando.lre:lre-*:0.1.0-dev`;
the app consumes them through the composite build, never from a
repository. `network-*` is our shared network code (`network/`), an
included build here and in the app. `launcher/` sources are compiled by the app's CMake
(`app/modules/phonecando-linux/android/CMakeLists.txt`); `proot/` and
`images/default/` outputs are staged into that module's gitignored
`src/linux/` dirs.

- **api** — contracts only: `BaseImage` and its layers, `HostEnv`,
  `ImageLayout` and `PayloadNames`, `OsInfo`, `LreException` and the
  mapping of our network code's errors to it. It exposes `network-http`
  (`CancelSignal`, `Progress`, `ProgressSink`). Every other module depends
  on it.
- **tar** — `TarExtractor` applies one layer onto a guest root as the
  app's own uid: nothing in an archive reaches outside the root, hard links
  become copies, device nodes are skipped, limits stop hostile archives.
- **oci** — `RegistryClient` resolves a reference to its linux/arm64
  manifest and downloads digest-verified, resumable blobs; Docker Hub
  official images fall back to mirrors. `HubCatalog` lists official
  operating systems and arm64 tags for the Own env picker.
- **image** — `ImageSetup`, `ImageReset`, `ImageDelete`: turns a
  `BaseImage` into an image at an `ImageLayout` and keeps it working.
  Detection, fixups, shims, `launch.conf`, `engine.env`, `os-note.md`, the
  fake `/proc`.
- **cli** — `cli setup|refresh|run|env`: what `lre-compat.yml` runs, so CI
  tests distro images with the exact setup code the phone runs.
- **launcher** — clean-room C; `lre/launcher/src/conf.h` is the
  `launch.conf` contract; pure parser, exec plan and signal rules; forks
  proot once and returns as the command ends.
- **proot** — termux/proot at a pinned commit with talloc static, the
  loader unbundled and our `--status-fd`/`--setsid` patch, built for
  Android arm64 (and for glibc, for CI).
- **images/default** — a Debian-based arm64 rootfs built reproducibly,
  published as `linux-image-<version>` and locked by `lock.json`.

See `architecture.md` for the dependency law and the host boundary.
