# lre-cli

The phone's image download and setup on a plain JVM, for CI: `oci`'s
download and `image`'s setup, exactly as the app runs them, so
`lre-compat.yml` tests distro images with the code the phone runs. Not
published, not shipped; nothing depends on it.

Sources: `lre/cli/src/main/kotlin/com/phonecando/lre/cli/`. Depends on
`oci`, `image` and kotlinx-serialization-json (JSON output only).

```bash
cd lre && ./gradlew :cli:installDist
lre/cli/build/install/cli/bin/cli help
```

## Commands

| Command | What it does |
|---|---|
| `cli setup (--ref <ref> \| --tarball <rootfs.tar[.gz\|.xz]>) --image-dir <dir> --lib-dir <dir> [--data-dir <path>]... [--blobs <dir>] [--free-bytes <n>]` | Pulls the linux/arm64 image (or takes the tarball as its one layer, the Default image's way) and runs `ImageSetup.create`, resuming a setup cut short. Prints one JSON line: `os`, `missingTools`, `installCommand`, `socketPathTight`, `source`, `timingsMs`. |
| `cli refresh --image-dir <dir> --lib-dir <dir> [--data-dir <path>]...` | `ImageSetup.refreshForStart`, as the app runs it before every engine start. |
| `cli run --image-dir <dir> [--cwd <dir>] [--timeout <seconds>] -- <command>...` | `$SHELL -c "<command>"` with `run/engine.env` over our environment, as opencode runs a command. |
| `cli env --image-dir <dir>` | `run/engine.env` as shell `export` lines, for `eval` in a script. |

- `--lib-dir` holds `libproot.so`, `libproot-loader.so` and
  `libphonecando_launch.so` (the APK's native-library dir on a phone).
- `--data-dir` lists every data-dir spelling; the default is the image
  dir's parent. Paths are made physical (`toRealPath`), because the
  launcher compares `same` paths with `getcwd()`.
- `--blobs` defaults to `blobs/` next to the image dir; downloaded layers
  there are re-verified and reused.
- DNS comes from the host's `/etc/resolv.conf` (`host/ResolvConf.kt`).

Exit codes (`report/ExitCode.kt`): 0 ok, 1 other failure, 2 usage, 3 a
typed `LreException` (stderr `<code>: <message>`, the code being the
subclass name in snake_case, `report/ErrorCode.kt`). `run` passes the
command's own code through, or 124 when `--timeout` fired.

## Tests

`lre/cli/src/test/kotlin/com/phonecando/lre/cli/`: argument parsing,
compression sniffing of a tarball, engine-env parsing, host env, progress
lines, error codes, setup JSON and the dispatcher.

```bash
cd lre && ./gradlew :cli:test
```

In CI, `.github/ci/lre-compat/payload.sh` packs the installed tree with a
glibc proot and the launcher; each leg (`leg.sh`, `checks.sh`) runs
`cli setup`, `cli refresh`, `cli run` and `cli env`. See
`../guides/testing.md`.
