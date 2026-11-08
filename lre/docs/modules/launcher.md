# Launcher

`phonecando-launch`: runs one command inside a Linux image through proot.
Clean-room C11, no dependencies. It ships as `libphonecando_launch.so` in
the APK's native-library dir, the only app path Android lets us exec from;
every name in an image's `shims/` is a symlink to it.

Sources: `lre/launcher/src/`.

| File | Role |
|---|---|
| `conf.h` | The `launch.conf` contract: format, directives, exec rules, limits. |
| `conf.c` | The parser. Pure: no IO, no allocation; parses the buffer in place. |
| `plan.h`, `plan.c` | The exec plan: command, cwd, argv and environment. Pure. |
| `relay.h`, `relay.c` | Which caught signals go on to the command, and how the launcher ends for a wait status. Pure. |
| `standin.h`, `standin.c` | The IO of standing in: the status pipe, the terminal hand-over, the fork of proot, the wait, passing signals on, the end. |
| `die.h`, `die.c` | The one way to fail: `phonecando-launch: <reason>`, exit 127. |
| `main.c` | The IO: reads `$PHONECANDO_IMAGE/run/launch.conf`, builds the plan, hands it to the stand-in. |

## The `launch.conf` contract

One directive per line, `<keyword> <value>`; the value is the rest of the
line verbatim (spaces allowed, never a newline). Empty lines and `#`
comments are skipped; any other keyword is an error. At most 256 KiB and
4096 lines.

| Directive | Meaning |
|---|---|
| `arg VALUE` | One proot argv entry, in order; the first is the absolute path of proot. |
| `set KEY=VALUE` | Set KEY in proot's (and so the guest's) environment. |
| `unset NAME` | Remove NAME from the inherited environment; `NAME*` removes every variable with that prefix (`LD_*`). |
| `map NAME GUEST` | Invoked as NAME, run GUEST instead (`map bash /bin/sh` for an image without bash). |
| `same PATH` | Host PATH is bound at the same path in the guest; a current dir at or under it stays the guest cwd. |
| `home PATH` | Guest cwd when the current dir is under no `same` path (default `/`). |

The launcher then runs proot as its child:

- environment: the inherited one, every `unset` applied first, then every
  `set` (for a key set twice the later line wins);
- command: `basename(argv[0])`; our own file name (`lib*.so`) means bash,
  so `SHELL` can point at the launcher itself; then `map` (later line
  wins);
- cwd: the current dir when it is at or under a `same` path, else `home`
  (an unreadable current dir counts as under none);
- argv: every `arg`, `--status-fd=<fd>`, `--setsid` when it hands over a
  terminal (below), `--cwd=<cwd>`, the command, `argv[1..]`.

## Standing in for the command

proot traces the command and everything it starts, and lives until the
last of them ends, so the caller must not wait for proot: a command that
leaves `sleep 30 &` behind would take 30 s. The launcher stands in for the
command instead (`standin.c`, rules in `relay.h`):

1. It opens a pipe and passes proot its write end as `--status-fd` (our
   patch, `proot.md`), blocks the signals it catches (`SIGHUP`, `SIGINT`,
   `SIGQUIT`, `SIGTERM`, `SIGUSR1`, `SIGUSR2`) and reads them through a
   signalfd, then forks and execs proot with the old signal mask.
2. proot writes the command's pid, then its waitpid status, as native
   ints. The launcher exits with the same code, or dies by the same
   signal (no core of its own). Should proot end without a status (it
   failed to start, or it was killed), the launcher ends as proot did,
   proot's own message on stderr.
3. A caught signal goes on to the command, except what the kernel sends
   for a terminal's keys (they reach the foreground group by themselves;
   the hangup, which goes to the session leader alone, does go on) and
   what another process of the command's own group sends (the command got
   it too). The caller's own signals always go on: Java's `destroy()`
   shares the app's process group with the command. A signal sent to the
   whole group reaches the command twice, as under coreutils' `timeout`.
   One that comes before proot reports the pid waits for it.
4. When the launcher leads a session and its stdin is a terminal, it
   passes `--setsid`: the command takes that terminal for a session of its
   own, so the shell gets the hangup when the terminal closes and job
   control works, as on a PC. The terminal tab opens its PTY free
   (`handOver`) for this; Android gives apps no `TIOCNOTTY` or `TIOCGSID`
   on a PTY. A session that holds the terminal (a host's `script(1)`) lets
   it go first (`TIOCNOTTY`, with `SIGHUP` ignored meanwhile, since that
   hangs up our own group).

The caller's pipes stay as on a PC: proot drops them (`proot.md`), the
launcher holds them only until it exits, and a background job that writes
to stdout keeps the pipe open until it ends.

Any error (no or relative `PHONECANDO_IMAGE`, an unreadable or invalid
conf, no `arg`, an exec failure) prints `phonecando-launch: <reason>` to
stderr and exits 127. Parse errors name the file and line.

`lre/image`'s `conf/LaunchConf.kt` writes the file per image before every
engine start (`image.md`); `conf/Directive.kt` refuses any value the
launcher would reject or misread. A change to the contract changes
`conf.h`, the parser, its tests and the Kotlin writer in one change, plus
`.github/ci/lre-image/launch-conf.sh`, the hand-written stand-in the
Default image's Tier 1 run uses.

## Build

- App: `app/modules/phonecando-linux/android/CMakeLists.txt` builds an
  executable named `libphonecando_launch.so` (AGP packages only `lib*.so`)
  with `-Wall -Wextra -Werror` and `-Wl,-z,max-page-size=16384` for 16 KB
  pages. The play flavor passes `-DPHONECANDO_LINUX=OFF` and builds none.
- Host tests and CI: gcc `-std=c11 -O2 -Wall -Wextra -Werror`.

## Tests

```bash
bash lre/launcher/test/run.sh        # CC=clang to use another compiler
```

`run.sh` builds the launcher and `unit.c` (the pure parser, plan and
signal rules, including the edges end-to-end runs cannot reach cheaply),
then runs the launcher end to end in a temp image whose `launch.conf`
points at `fake-proot.sh`, which prints its argv and the variables under
test, then hands the status fd to `fake-tracer.c`, which plays proot's side
of `--status-fd`: symlinked shims, `map`, own-name-means-bash, cwd inside
and outside `same` paths (including a shared prefix), `unset` with a
prefix, `LD_PRELOAD` dropped, the command's exit code and signal death
passed through, a return while proot stays behind, proot failing to start
or dying, a signal for the launcher reaching the command (also before its
pid is known) and one from the command's own group not coming back, every
error message, and a conf of exactly 256 KiB against one byte more.
`lre.yml` runs it on every launcher change.

```bash
bash lre/proot/build-glibc.sh <work> <proot-dir>
bash lre/launcher/test/proot-test.sh <proot-dir> <rootfs> [<scratch>]   # / works as the rootfs
```

`proot-test.sh` runs the launcher with a real (host) proot build: `(sleep
&); echo hi` returns at once with status 0 and end-of-file while the sleep
runs on; a background job that holds stdout keeps the pipe open, not the
launcher; exit codes and deaths by SIGTERM and SIGKILL; a setsid daemon
survives in its own session; a later command sees a job and kills it, and
its `kill -STOP` holds the job until `kill -CONT`; the proot left behind
holds only `/dev/null`, has left our session and takes its tracees with it
when killed. With bash in the rootfs, a terminal, twice: one the
launcher's session holds (`script(1)`) and a free one, as the app's
terminal tab opens it (`python3`): the shell leads its session, Ctrl-C
ends the foreground job only, Ctrl-Z stops a job for real, `fg` and `bg`
resume it, a background job reading the terminal or writing it under
`stty tostop` stops too, and closing the terminal hangs up the shell's
jobs while a `nohup`'d one survives. "Stopped for real" is `/proc` state
`T` or `t` with no context switch for half a second, so a job proot keeps
stopping and restarting fails it. `proot.yml` runs it in the Alpine rootfs
and in the runner's own root.
