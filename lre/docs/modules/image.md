# lre-image

Turns a `BaseImage` into a working image at an `ImageLayout` and keeps it
working: setup, the per-start refresh, reset and delete. Writes every file
under `run/`.

```kotlin
implementation("com.phonecando.lre:lre-image:0.1.0-dev")
```

Sources: `lre/image/src/main/kotlin/com/phonecando/lre/image/`; paths
below are relative to it. Depends on `api` and `tar` (both exposed), never
on `oci`.

## Entry points

| Call | What it does |
|---|---|
| `ImageSetup(unpacker).create(layout, base, host, freeBytes, sink, cancel)` | Runs or resumes the setup steps for a Linux image; returns `SetupResult`. |
| `ImageSetup.android(layout, host)` | An image with no Linux: `home/`, `tmp/`, `logs/`, `run/`, an `engine.env` with HOME and TMPDIR. A rootfs already there is left alone. |
| `ImageSetup.refreshForStart(layout, host)` | Before every engine start or terminal: finish a cut-short reset, re-detect, rewrite what depends on the phone. `NotFound` when setup never finished. |
| `ImageSetup.isReady(layout)` | `create` or `android` finished. |
| `ImageReset(runner, unpacker).reset(layout, base, host, freeBytes, sink, cancel)` | Fresh system from the base, `home/` kept; returns `ResetResult`. |
| `ReinstallList.read/clear(layout)` | The packages a reset offers to reinstall (`run/reinstall.txt`). |
| `ImageDelete().delete(layout, executor)` | Atomic move into `images/.trash/`, then a background delete; `emptyTrash(dir)` after a kill. |
| `TreeDeleter().delete(dir)` | Deletes a tree a guest wrote: never follows a symlink, fixes read-only dirs, iterative. |
| `SpaceCheck`, `SocketBudget` | The space estimate (2.5x the compressed layers) and the socket-path check the host uses when picking an id. |

`Unpacker` is the seam for unpacking; `TarUnpacker` is the real one
(`lre-tar`). The host wraps it to turn per-layer byte counts into one count
over the whole base (`LayerProgressUnpacker`).
`GuestRunner` runs one guest command for a reset's package query; the
host's `GuestProcessRunner` goes through the image's shims.

`SetupResult`: the detected `OsInfo` (null for Android), the agent tools
the image lacks (`bash`, `git`, `rg`), one line that installs them (null
when none are missing or the family is unknown) and `socketPathTight`.

## Setup steps

`setup/SetupStep.kt`, recorded in `run/setup-state` (`setup/SetupState.kt`);
the done steps are always a prefix, and a retry resumes at the first
missing one.

| Step | Code | Does |
|---|---|---|
| `space` | `setup/SpaceCheck.kt` | Free space ≥ 2.5x the compressed layers (a layer of unknown size counts 0). |
| `unpack` | `setup/TarUnpacker.kt` | Clears `rootfs/` and applies every layer. |
| `detect` | `detect/Detector.kt` | os-release, package family, shell; recorded in `run/image.properties` (`record/`). |
| `fixups` | `fixup/Fixups.kt` | `resolv.conf` (the phone's DNS, else 1.1.1.1 and 8.8.8.8), `hosts`, `hostname` (`phonecando`), the family's proot fix, `/bin/sh` for a busybox-only image. |
| `shims` | `shim/Shims.kt` | One symlink in `shims/` per executable on the guest PATH, plus `bash` and `sh`, each pointing at the launcher. |
| `seed` | `setup/Seeder.kt` | The dirs, fake `/proc`, `engine.env`, `launch.conf`, `os-note.md`. |

## Detection and families

`detect/Detector.kt` looks only at the image: its config's PATH (else
Debian's root PATH, `guest/GuestPath.kt`), `/etc/os-release` or
`/usr/lib/os-release`, and the binaries on that PATH. The shell is `bash`,
else `sh`, `ash`, or busybox (then fixups link `/bin/sh`); none is
`NoShell`. The image config's `Env` passes `detect/ImageEnv.kt`'s filter;
`User` and `WorkingDir` are recorded, not applied.

`family/Families.kt` is the one table: per family the binary that
identifies it, the install and refresh commands, the package for each
agent tool (`rg` → `ripgrep`), how to list hand-installed packages for a
reset, and the proot fix. Detection order matters (dnf before yum).

| Family | Install line | Hand-installed list | proot fix |
|---|---|---|---|
| apt | `apt-get update && apt-get install -y` | `apt-mark showmanual` | `APT::Sandbox::User "root"` |
| apk | `apk add` | `/etc/apk/world` | — |
| dnf | `dnf install -y` | `dnf repoquery --userinstalled` | — |
| microdnf | `microdnf install -y` | — | — |
| yum | `yum install -y` | `yum repoquery --userinstalled` | — |
| pacman | `pacman -Sy && pacman -S --noconfirm` | `pacman -Qqe` | `DisableSandbox`, `DownloadUser` commented out |
| zypper | `zypper install -y` | `zypper packages --userinstalled` | — |
| xbps | `xbps-install -S && xbps-install -y` | `xbps-query -m` | — |

## Run files

Pure builders, paths in and text out:

- `conf/LaunchConf.kt` — `run/launch.conf` (format: `lre/launcher/src/conf.h`;
  `launcher.md`). proot flags, binds, the unset secrets, the
  guest environment, `map` lines for a missing `bash` or `sh`, `same` lines
  for `home/` and `tmp/` under every data-dir spelling
  (`conf/PathSpellings.kt`), `home /root`. `conf/Directive.kt` checks each
  value against the launcher's rules and throws `UnsafeEntry` rather than
  write a line it would reject; `render` enforces 256 KiB and 4096 lines.
- `conf/EngineEnv.kt` — `run/engine.env`.
- `conf/OsNote.kt` — `run/os-note.md`: OS and version, package manager and
  its install command, no systemd, commands run as root.
- `proc/FakeProc.kt` — `run/proc/{loadavg,stat,uptime,version,vmstat}`:
  static stand-ins for what Android's sepolicy hides, listing the host's
  online CPU ids (`proc/CpuIds.kt`); kernel release `6.1.0-phonecando`.
- `conf/SocketBudget.kt` — flags an image whose `home/` or `tmp/`, under
  any spelling, leaves fewer than 40 of the 108 `sun_path` bytes for socket
  names.

Every write goes through `files/TextFiles.kt`: skipped when the content is
already there, written to a temp file and renamed over the name (which
replaces a symlink instead of following it). Guest paths resolve
guest-side (`guest/GuestFs.kt`): an absolute symlink restarts at the
rootfs, so a link like `/etc/resolv.conf -> /run/...` never leads to a host
file.

## Reset and delete

- `reset/ImageReset.kt` — needs a ready Linux image; lists hand-installed
  packages (best effort: a failed query gives an empty list), unpacks
  `rootfs.new/`, detects and fixes it, then `reset/RootfsSwap.kt` writes
  `run/reset-swap` and swaps by rename. `recover` (also run by every
  refresh) finishes a swap the marker says is complete and throws away a
  cut-short unpack. The marker becomes `run/reinstall.txt`
  (`reset/ReinstallList.kt`: `command <line>`, then `package <name>`
  lines). After the swap the same query runs in the fresh rootfs and the
  list loses what the base itself marks as hand-installed; when that
  second query fails, the first list stands.
- `delete/ImageDelete.kt` — the trash sits next to the images
  (`ImageDelete.trashFor`), so the rename never crosses a filesystem.

The host stops the image's engine and reaps its processes before either
(`../overview/architecture.md` → Background processes).

## Tests

`lre/image/src/test/kotlin/com/phonecando/lre/image/`: setup and resume,
tar setup end to end, detection, os-release, image env, families and proot
fix text, fixups, guest paths, shims, `launch.conf` (parsed back with a test
parser, `support/ConfParser.kt`), `engine.env`, os note, path spellings,
fake `/proc`, record codec, reset and swap recovery, tree delete. Distro
trees and tars are built in the test (`support/`).

```bash
cd lre && ./gradlew :image:test
```
