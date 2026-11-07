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
| `main.c` | The IO: reads `$PHONECANDO_IMAGE/run/launch.conf`, builds the plan, `execve`s proot. |

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

The launcher then execs, never forking:

- environment: the inherited one, every `unset` applied first, then every
  `set` (for a key set twice the later line wins);
- command: `basename(argv[0])`; our own file name (`lib*.so`) means bash,
  so `SHELL` can point at the launcher itself; then `map` (later line
  wins);
- cwd: the current dir when it is at or under a `same` path, else `home`
  (an unreadable current dir counts as under none);
- argv: every `arg`, `--cwd=<cwd>`, the command, `argv[1..]`.

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

`run.sh` builds the launcher and `unit.c` (the pure parser and plan,
including the edges end-to-end runs cannot reach cheaply), then runs the
launcher end to end in a temp image whose `launch.conf` points at
`fake-proot.sh`, which prints its argv and the variables under test:
symlinked shims, `map`, own-name-means-bash, cwd inside and outside `same`
paths (including a shared prefix), `unset` with a prefix, `LD_PRELOAD`
dropped, every error message, and a conf of exactly 256 KiB against one
byte more. `lre.yml` runs it on every launcher change.
