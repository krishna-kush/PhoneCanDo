# Architecture

## Product statement

Give every agent on the phone a VM-like Linux machine: its own package
manager, shell, git and toolchains, without root and without kernel
features an app cannot use. The LRE turns a fixed base OS into such an
image and runs commands in it through proot. It is not the PhoneCanDo app;
nothing in `lre/` depends on Android, Expo, React Native or the app.

## Host boundary

The LRE owns unpacking (`tar`), pulling images and the Docker Hub catalog
(`oci`), setup, the per-start refresh, reset and delete (`image`), the
image layout (`api`), the launcher and its `launch.conf` contract
(`launcher/`), the proot build (`proot/`) and the Default image build
(`images/default/`).

The host owns everything stateful and visible:
`app/modules/phonecando-linux/` keeps the env and image records, runs jobs
with progress events, gives setup the phone's `HostEnv`, refuses Linux on
play (`LinuxGate`), stops an image's processes before a reset or delete
(`ImageReaper`), builds the launcher (CMake) and packages proot and the
Default image. The runner (`app/modules/phonecando-runner/`) starts engines
in an image's `home/` with its `run/engine.env`, writes `logs/engine.log`
and reads `run/os-note.md`; it never depends on `lre/`. JS reaches the host
only through `app/src/engine/linux/`.

The app's settings plugin includes `lre/` as a composite build
(`app/plugins/withLreCompositeBuild.js`) and substitutes the coordinates
`com.phonecando.lre:lre-{api,tar,oci,image}` with the projects.

## Mental model

```
env    a fixed base OS, never modified
  ├─ Default   Debian-based arm64 rootfs baked into the APK (one xz layer)
  ├─ Own       a linux/arm64 registry image; layers kept compressed, verified
  └─ Android   no Linux
     │  ImageSetup.create(base) / ImageSetup.android()
     ▼
image  files/images/<id>/  one VM-like machine made from an env
     │
     ▼
agent  exactly one per image; its engine runs with run/engine.env
```

- An env is a `BaseImage`: layers applied in order, plus the registry
  image's Docker config (none for the Default image). The host makes it
  from the APK asset (`DefaultImageAsset`) or from blobs it downloaded with
  `RegistryClient` (`files/envs/<id>/`).
- An image is everything the agent changes: the system (`rootfs/`) and its
  home (`home/`). Reset replaces the system and keeps home.
- An Android image has `home/`, `tmp/`, `logs/` and an `engine.env` with
  HOME and TMPDIR only; the agent uses Android's shell. Setup can add Linux
  to it later and keeps `home/`.

## On-disk layout

`ImageLayout` (`lre/api/src/main/kotlin/com/phonecando/lre/api/ImageLayout.kt`)
is the contract. Under the app's `filesDir`:

```
images/<id>/
  rootfs/            the Linux system; absent for an Android image; replaced whole on reset
  rootfs.new/        only while a reset unpacks; rootfs.old/ only while it swaps
  home/              HOME: agent config, chats, projects, keys; survives reset
  tmp/               TMPDIR
  shims/             one symlink per guest command -> <libDir>/libphonecando_launch.so
  logs/              engine.log (the runner writes it)
  run/
    launch.conf      how the launcher starts proot (contract: lre/launcher/src/conf.h)
    engine.env       the engine's environment for this image
    os-note.md       a line for the agent's instructions; Linux only
    setup-state      finished setup steps, one per line, or `android`
    image.properties what setup detected, and the image config
    reinstall.txt    packages installed by hand before the last reset; optional
    reset-swap       only while a reset swaps rootfs/
    proc/            fake loadavg, stat, uptime, version, vmstat
    shm/             bound at /dev/shm
    proot-tmp/       PROOT_TMP_DIR
    l2s/             PROOT_L2S_DIR: link2symlink's files
images/.trash/       deleted images, emptied in the background
envs/<id>/           an Own env's base.json and blobs/ (the host's)
state/               envs.json, images.json (the host's records)
```

Who reads the `run/` files:

| File | Written by | Read by |
|---|---|---|
| `launch.conf` | `image` (`conf/LaunchConf.kt`) | the launcher, on every guest command |
| `engine.env` | `image` (`conf/EngineEnv.kt`) | the runner (`ImageDir.readEnv`), the host's `GuestProcessRunner`, `cli run`/`env` |
| `os-note.md` | `image` (`conf/OsNote.kt`) | the runner, into the agent's instructions (`engine/image/OsNote.kt`) |
| `reinstall.txt` | `image` (`reset/`) | the host, through `ReinstallList` |
| `setup-state`, `image.properties`, `reset-swap` | `image` | `image` only |

`engine.env` always has `HOME` and `TMPDIR` (host paths of `home/` and
`tmp/`). A Linux image adds `SHELL` (`shims/bash`), `PATH` (`shims/` first,
then Android's), `PHONECANDO_IMAGE` (the image root) and `MAKEFLAGS=-j4`
(a default cap on parallel jobs: Android kills an app's processes past a
device-wide limit, and `run/os-note.md` tells the agent what a SIGKILL from
it means). The runner applies
every line over its own environment and tags the engine with
`PHONECANDO_AGENT` itself.

Image ids are short (`ShortIds`: six characters preferred, down to three)
because every Unix socket under `home/` and `tmp/` carries the id in its
path, and `sun_path` holds 108 bytes (`SocketBudget`).

## How a command runs

The engine stays a bionic binary started from the native-library dir,
outside proot. Only its shell and its commands go through the shims:

```
engine  (env: run/engine.env)
  $SHELL -c "git status"                        SHELL=<image>/shims/bash
    shims/bash -> <libDir>/libphonecando_launch.so      stands in for the command
      reads $PHONECANDO_IMAGE/run/launch.conf
      fork, execve <libDir>/libproot.so <arg lines> --status-fd=<fd> --cwd=<cwd> bash -c "git status"
        PROOT_LOADER=<libDir>/libproot-loader.so
        guest: bash as fake root, then git from the guest PATH
      reads the command's pid and end from <fd>, exits as it did
```

- The launcher is multi-call: it runs the command named by `argv[0]`'s
  basename; its own file name (`lib*.so`) means bash, so `SHELL` can point
  at it. `map` lines substitute the image's shell for a missing `bash` or
  `sh`. It forks proot once and stands in for the command (below).
- proot flags (`LaunchConf.PROOT_FLAGS`): `-L`, `--link2symlink`,
  `--sysvipc`, `-0` (fake root) and `--kernel-release=6.1.0-phonecando`.
  No `--kill-on-exit` (see below). The launcher adds `--status-fd` and, on
  the terminal tab's PTY, `--setsid` (our patch, `../modules/proot.md`).
- Binds: the host's `/dev`, `/proc`, `/sys`, `/dev/urandom` at
  `/dev/random`, the fd links (`/dev/fd`, `/dev/stdin`, `/dev/stdout`,
  `/dev/stderr`), `run/shm` at `/dev/shm`, each `run/proc/<name>` over
  `/proc/<name>`, `home/` at `/root`, `tmp/` at `/tmp`, `home/` and `tmp/`
  again at their own host path under every data-dir spelling, and `run/l2s`
  at its own path (link2symlink writes absolute host paths into the links
  it makes).
- Environment: the inherited one, minus `LD_*` and the names the host
  passes before a start (`guestUnset`: the secrets its engine holds, e.g.
  opencode's password and the bridge token); then `PROOT_LOADER`,
  `PROOT_TMP_DIR`, `PROOT_L2S_DIR`, the guest's `PATH` and `SHELL`, `USER`
  and `LOGNAME` `root`, `LANG=C.UTF-8` unless the image sets it, and the image config's
  other variables (`ImageEnv`). `HOME` and `TMPDIR` stay the host paths,
  which are bound in the guest. `TERM` is never set.
- cwd: a current dir at or under a `same` path stays the guest cwd;
  anything else starts in `/root` (the `home` line).

### Two spellings of the data dir

Inside the app process `getcwd()` says `/data/data/<pkg>/...` while
Context's dirs say `/data/user/0/<pkg>/...`; both name one dir
(device-verified, `../../../app/docs/context.md`).
`HostEnv.dataDirSpellings` lists every spelling, canonical first (the
host's `DataDirSpellings`), and `launch.conf` binds `home/` and `tmp/` at
each and lists each as a `same` path (`PathSpellings`), so a command keeps
its project folder whichever spelling its cwd has. A secondary user or
adoptable storage has one spelling.

## Image lifecycle

All entry points are in `lre/image`. The host calls them on its own
executor under a per-image lock (`ImageOps`); create and reset run as jobs
with progress events.

- **Setup** (`ImageSetup.create`): `space → unpack → detect → fixups →
  shims → seed`. Each step is idempotent and recorded in
  `run/setup-state`, so a failed or killed setup resumes at the step that
  failed; an interrupted unpack starts again from an empty `rootfs/`.
  Detect reads the OS, its package-manager family and its shell; fixups
  write DNS, hosts, hostname and the package manager's proot fix; seed
  writes the dirs and every `run/` file. Which tools an agent needs the
  host asks afterwards (`ImageSetup.checkTools`): the commands the guest
  PATH lacks, with one line that installs them.
- **Refresh before start** (`ImageSetup.refreshForStart`): before every
  engine start and terminal the host runs it (`prepareForStart`). It
  finishes a reset a kill cut short, re-detects (redoing fixups only on a
  change), then rewrites what depends on the phone: DNS, shims and
  `launch.conf` (the APK's lib dir moves on every update), `engine.env` and
  the fake `/proc`. Cheap when nothing changed.
- **Reset** (`ImageReset.reset`): lists packages installed by hand (a
  guest command through `GuestRunner`, or a guest file), unpacks a fresh
  base into `rootfs.new/`, detects and fixes it, writes the
  `run/reset-swap` marker, then swaps it in by rename and deletes the old
  one. A failure or kill before the swap leaves the image as it was; the
  next start finishes a swap the marker says is complete. `home/` is kept;
  the package list lands in `run/reinstall.txt` for the UI to offer. Once
  the fresh rootfs is in, the same query there drops what the base itself
  marks as installed by hand (the Default image installs its tools that
  way), so only what the user added is offered.
- **Delete** (`ImageDelete`): one atomic rename into `images/.trash/` (the
  image is gone for every reader at once and its id is free again), then a
  background tree delete that never follows a symlink. Once per app
  process the host finishes deletes a kill cut short and empties the trash
  (`LinuxHost.recoverOnce`).

## Background processes

As on a PC, a command returns as soon as it ends, while what it starts in
the background (`cmd &`, `nohup`, a daemon, a package manager's gpg-agent)
keeps running. proot lives until its last tracee ends, so the caller never
waits for proot: the launcher forks it with a status pipe (`--status-fd`,
our patch) and exits as the command did (`../modules/launcher.md` →
Standing in for the command).

- proot leaves the caller's session and stdio right away; the command
  stays in the caller's process group, so a timeout's group kill reaches it
  and its jobs. A background job that writes to stdout keeps the caller's
  pipe open, as on a PC.
- proot keeps tracing what is left and exits with its last tracee, which
  dies with it (`PTRACE_O_EXITKILL`). Every guest process is a real process
  of the app: a later command sees it in `ps` and can `kill` it.
- In the terminal tab the shell takes the PTY for its own session
  (`--setsid`): job control and Ctrl-C work, Ctrl-Z holds a job until `fg`
  or `bg` (proot attaches with `PTRACE_SEIZE`, `../modules/proot.md` → Job
  control), and closing the tab hangs up the shell, which hangs up its
  jobs. Limits (SysV IPC across commands): `../release/known-limits.md`.

Two tags stop them, both kept in the guest's environment:

- `PHONECANDO_AGENT` (set by the runner on the engine): stopping the engine
  reaps every process with the agent's tag.
- `PHONECANDO_IMAGE` (from `engine.env`; the Linux terminal sets it too):
  before a reset or delete the host stops every process of the app's uid
  carrying the image's root (`ImageReaper`: SIGTERM, up to 3 s, then
  SIGKILL), so nothing runs while the system is swapped or removed. The
  host's guest runner does the same after each of a reset's package
  queries, whose package manager may leave a gpg-agent behind.

The proot left behind carries the tags too, so a reaper that kills it also
ends a tracee that dropped its environment (`env -i`). The terminal never
sets `PHONECANDO_AGENT`, and neither does the host's guest runner: an
engine start reaps whatever carries it.

## Dependency law

The module law is in `../../AGENTS.md` §2. Beside the Gradle build: `launcher/` (C, built by the app's CMake and by
the tests with gcc), `proot/` (shell build scripts) and `images/default/`
(a docker build). None of them depends on the JVM modules; the
`launch.conf` contract ties `launcher/` to `image`.
