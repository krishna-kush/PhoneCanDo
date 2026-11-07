# Testing

## Test layers

| Layer | Command | Covers |
|---|---|---|
| JVM unit tests | `cd lre && ./gradlew build` (or `:tar:test`, `:oci:test`, `:image:test`, `:cli:test`) | Every module's logic against recorded responses and synthetic trees and tars. |
| Live registry | `cd lre && LRE_LIVE=1 ./gradlew :oci:test` | `alpine:latest` resolved and downloaded from Docker Hub, the catalog listed. Spends one anonymous pull. |
| Launcher | `bash lre/launcher/test/run.sh` | The pure parser and plan (`unit.c`), then end to end through `fake-proot.sh`. |
| proot (Android) | `build-android.sh` + `verify.sh` | ELF-level proof of the arm64 build; no runner can exec bionic. |
| proot (host) | `build-glibc.sh` + `.github/ci/proot/smoke.sh` | The same sources booting an Alpine rootfs the way the app runs proot. |
| Default image | `python3 -I lre/images/default/verify.py <out-dir>` | A build against its manifest and our rules. |
| Tier 1 | `.github/ci/lre-image/setup.sh` + `tier1.sh` | The Default image through our launcher and proot, as opencode runs commands. |
| Tier 2 / 3 | `.github/ci/lre-compat/leg.sh` | A registry image set up with `cli` and used as opencode uses it. |
| Host | `./gradlew :phonecando-linux:testLiteDebugUnitTest` (from `app/android`) | Records, jobs, ids, error codes, terminal recipes, guest commands, the process selection of the reaper, play refusals. |
| Device | logcat, `adb exec-out screencap` | Anything proot does on the phone. |

Fixtures: `oci` replays recorded registry and Hub responses
(`lre/oci/src/test/resources/`) through a fake transport and registry
(`testkit/`); `image` builds tiny distro trees and tars in the test
(`support/`); `tar` builds archives with `support/TarBuilder.kt`. No unit
test touches the network.

## Tiers

- **Tier 1** (`lre-image.yml`, blocks publishing): the baked Default image
  laid out the way the app does it (`setup.sh`; `launch.conf` written by
  `launch-conf.sh`, a hand-written stand-in for `LaunchConf.kt`), then
  `tier1.sh`: bash, git, rg, python3 through `$SHELL -c` and their shims,
  fake root, the image marker, UTF-8, the cwd contract, `home/` at its own
  path and at `/root`, a git commit read back from the host side, hard
  links under `--link2symlink`, a venv with a pip install, and
  `apt-get install` as the fake root.
- **Tier 2** (`lre-compat.yml`, blocking): one registry image per package
  family `lre/image` knows: `debian:stable` and `ubuntu:24.04` (apt),
  `alpine:latest` (apk), `fedora:latest` (dnf), `almalinux:9-minimal`
  (microdnf, with EPEL first), `opensuse/leap:latest` (zypper). pacman,
  yum and xbps have no current official arm64 image. Each leg: `cli setup
  --ref`, the detected family, a shell as fake root, the install command
  from the setup result, `cli refresh` for the new shims, git and rg
  through their shims, a commit in `home/`, the cwd contract, and nothing
  executable in `PROOT_TMP_DIR`.
- **Tier 3** (`lre-compat.yml`, report-only, weekly and on demand): a few
  images per ISO week from `.github/ci/lre-compat/tier3.txt` (older and
  other distros, `busybox` for the unknown-family path); failures open or
  update one issue, "Linux image compatibility report". Tier 3 never makes
  `lre-compat-ok` red.

## CI workflows

Each workflow runs only for the `paths:` it lists, plus weekly and on
demand. The `*-ok` job is the one check to require.

| Workflow | Gate | Proves | Runs on changes to |
|---|---|---|---|
| `lre.yml` | `lre-ok` | `./gradlew build` (every module and test); the launcher with gcc and its host tests | the Gradle modules and build files, `lre/launcher/**` |
| `proot.yml` | `proot-ok` | the Android build verified and bit-identical twice; the glibc build booting Alpine; the GPL source tarball packed twice with the same bytes | `lre/proot/**` |
| `lre-image.yml` | `lre-image-ok` | the Default image built twice to the same bytes and verified; Tier 1; its Debian sources; `lock.json` against GitHub; on prod, weekly or on demand, publishing `linux-image-<version>` | `lre/images/default/**`, `lre/launcher/**`, `lre/proot/**` |
| `lre-compat.yml` | `lre-compat-ok` | `:cli:test`; Tier 2 legs; Tier 3 report | the Gradle modules, `lre/launcher/**`, `lre/proot/**` |
| `android.yml` | — | the app module that builds the launcher with the NDK and compiles the runtime; the host's JVM tests per channel; a release-shape build that stages proot from a `proot.yml` run id and the locked Default image when there is one | the Gradle modules, `lre/launcher/**`, `lre/proot/stage.sh`, `lre/images/default/lock.json`, `lre/images/default/lock/**` |

Each workflow also lists itself and its helpers under `.github/ci/`. When
a change gives one of them a new input, add the path to its `paths:` in the
same change (`../../AGENTS.md` §10). The repo-wide table is in
`../../../docs/guides/testing.md`.

## Device evidence

Unit tests and CI run on glibc hosts; the phone runs bionic, Android's
sepolicy and its W^X rules. What proot, the launcher or an image does on
the phone needs logs or pixels from a device. Proven so far (Moto G96,
Android 16, full debug build, 2026-11-06): proot with its unbundled loader
and our launcher, by its own name and through a symlinked shim, exec from
the engine's process with no denials; an Alpine image works as fake root
with `apk`; the engine's secrets are scrubbed
(`../../../app/docs/context.md`, `../../../docs/overview/status.md`). The
baked Default image followed (2026-11-07, staged locally in a full debug
build): first launch makes the Default env and a machine from the stored
xz asset, and an agent's commands run in Debian as fake root (`apt-get`,
`python3`, `git`).
