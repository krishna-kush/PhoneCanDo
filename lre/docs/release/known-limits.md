# Known limits

These are not scheduled work unless they are also listed in
`../planning/todo.md`. App-level limits are in
`../../../docs/release/known-limits.md`.

## Runtime

- Not a VM: one kernel (Android's), no systemd or other init; start
  services by hand (`run/os-note.md` tells the agent). `uname -r` says
  `6.1.0-phonecando`, and `/proc/loadavg`, `stat`, `uptime`, `version` and
  `vmstat` are static stand-ins for what Android's sepolicy hides
  (`FakeProc`); only the CPU ids are the host's.
- Not a security boundary inside the app: guest commands are processes of
  the app's own uid, root is proot's fake root (`-0`), and the host's
  `/dev`, `/proc` and `/sys` are bound in. Android's per-app sandbox is the
  boundary.
- Every guest program runs under proot's ptrace, which costs time: CI
  gives one package install up to 30 minutes (`lre-compat.yml`).
- arm64 only: linux/arm64 images (variant `v8` or none), and no 32-bit
  loader, so a 32-bit guest binary fails to exec.
- Unix socket paths are capped at 108 bytes. Setup flags an image whose
  `home/` or `tmp/` leaves fewer than 40 bytes for socket names under any
  data-dir spelling (`SocketBudget`); the host picks shorter ids then.
- `TERM` is never set by `launch.conf`: engine commands have no terminal,
  and the terminal's PTY sets its own.
- A background process outlives its command. Stopping the engine stops
  the agent's; a daemon started from the terminal carries only the image
  tag, so an engine stop leaves it running and a reset or delete stops it.
- Each command has its own proot: commands see and signal each other's
  processes (`ps`, `kill`), but SysV IPC and `strace -p`/`gdb -p` work
  only within one command. Every proot left tracing background jobs
  counts toward Android's phantom process limit.
- A stopped job (Ctrl-Z, SIGSTOP, SIGTTIN, SIGTTOU) is held by its proot
  (`PTRACE_LISTEN`, `../modules/proot.md` → Job control), so `ps` and
  `/proc` show it as `t` (tracing stop), not `T` (stopped).
- A signal sent to the launcher's whole process group reaches the command
  twice, as under coreutils' `timeout`; SIGKILL to the launcher alone
  leaves the command running until a reaper ends it.
- Commands installed while the engine runs get a shim at the next refresh
  (the next engine start or terminal); through `$SHELL -c` they run at
  once from the guest PATH.
- A guest command name with whitespace, a leading `.` or the shape
  `lib*.so` gets no shim (`ShimNames`).
- `launch.conf` holds at most 256 KiB and 4096 lines; no value may contain
  a line break or NUL, and no bind path a `:`.
- Device coverage: one phone, Android 16 (Moto G96).

## Images and registries

- Anonymous pull only: a private image reads as not found.
- Docker Hub allows about ten anonymous pulls an hour per IP. Official
  (`library/`) images then come from `public.ecr.aws` or `mirror.gcr.io`;
  other images have no mirror and fail as rate limited.
- Refused: zstd layers, foreign and non-distributable layers, tar sparse
  files and multi-volume members, Docker schema 1 manifests.
- Per layer: at most 500,000 entries, 16 GiB of file data, 8 GiB per file,
  4096-byte names (`TarLimits`); an xz header asking for more than 256 MiB
  of dictionary is refused.
- Unpacking as one uid: hard links become copies (more space), device
  nodes and FIFOs are skipped, setuid, setgid and sticky bits are dropped.
- The catalog's main source is Docker Hub's undocumented search API. Its
  fallback lists only the top 100 official images by pulls, without logos
  or an arm64 filter (tags filter arm64 later).
- Only an image config's `Env` is applied (filtered by `ImageEnv`);
  `User` and `WorkingDir` are recorded, not applied, and nothing runs
  `Entrypoint` or `Cmd`.

## Setup and reset

- The space check is an estimate: 2.5x the compressed layers; a layer of
  unknown size counts as 0.
- Package families we know: apt, apk, dnf, microdnf, yum, pacman, zypper,
  xbps. Another package manager works but gets no install line and no
  reinstall list.
- Blocking CI covers apt, apk, dnf, microdnf and zypper; pacman, yum and
  xbps have no current official arm64 image to test.
- Reset offers hand-installed packages for reinstall; it does not
  reinstall them. microdnf has no query for them, and a failed query
  (the host's guest runner stops it after 60 s) gives an empty list.

## Default image

- `lock.json` locks no image yet, so no build ships the Default image
  unless it is staged locally for a debug build (`../planning/todo.md`).
- Only the baked packages are pinned: `apt-get update` in an image uses
  Debian's own sources (`deb.debian.org`), not the build's snapshot, so
  what the agent installs later is current, not reproducible.

## Platform

- Play ships no Linux: it compiles the JVM modules but refuses every Linux
  path at run time (`LinuxGate`), and carries no launcher, proot or image.
- A secondary Android user or a data dir on adoptable storage has a single
  data-dir spelling; only the first user's internal storage has two.
