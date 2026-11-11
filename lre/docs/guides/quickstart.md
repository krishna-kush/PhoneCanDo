# Quick start

Commands run from the repo root unless they `cd lre` first.

## JVM modules

```bash
cd lre && ./gradlew build                 # api, tar, oci, image, cli and their tests
cd lre && ./gradlew :image:test           # one module
cd lre && LRE_LIVE=1 ./gradlew :oci:test  # adds the live Docker Hub test (spends one anonymous pull)
```

The wrapper is Gradle 9.3.1. Every module builds with a JDK 17 toolchain
(its `build.gradle.kts`) and Kotlin 2.2.10 (`lre/build.gradle.kts`).

## Launcher

```bash
bash lre/launcher/test/run.sh             # gcc by default; CC=clang works too
```

## CLI

```bash
cd lre && ./gradlew :cli:installDist
lre/cli/build/install/cli/bin/cli help
```

## Run a registry image on an arm64 Linux host

This is what one `lre-compat.yml` leg does: a glibc proot, the launcher
and `cli`, then a real image set up and used through the shims. It needs
gcc, make, gawk, readelf, curl, jq, a JDK 17 and network; the images are
arm64, so the host must be too.

```bash
(cd lre && ./gradlew :cli:installDist)
bash .github/ci/lre-compat/payload.sh /tmp/lre-work /tmp/lre-work/payload.tar.gz
bash .github/ci/lre-compat/leg.sh alpine:latest apk /tmp/lre-work/payload /tmp/lre-leg
```

`payload.sh` leaves `lib/` (`libproot.so`, `libproot-loader.so`,
`libphonecando_launch.so`) and `cli/` in `/tmp/lre-work/payload`; the leg
prints a markdown table and keeps the image in `/tmp/lre-leg/images/c1`.
To poke at it yourself:

```bash
cli=/tmp/lre-work/payload/cli/bin/cli
$cli run --image-dir /tmp/lre-leg/images/c1 -- 'cat /etc/os-release; id -u'
```

## How the app pulls `lre/` in

- `app/plugins/withLreCompositeBuild.js` adds `includeBuild('../../lre')`
  to the generated `app/android/settings.gradle` and substitutes
  `com.phonecando.lre:lre-api`, `lre-tar`, `lre-oci` and `lre-image` with
  the projects. `app/modules/phonecando-linux/android/build.gradle` depends
  on those coordinates in every flavor; play compiles them and refuses each
  Linux path at run time (`LinuxGate`).
- The module's CMake builds the launcher from `lre/launcher/src/` (not on
  play).
- proot and the Default image are staged, not built, by the app build:
  `bash lre/proot/stage.sh <dir>` (`../modules/proot.md`) and
  `./manage image fetch && ./manage image stage` (`images.md`). Both
  targets are gitignored.

An `lre/` change is native code for the app: it needs a native rebuild
(`pnpm android:<channel>`), not a Metro reload. The host module's own JVM
tests run from `app/android`:

```bash
./gradlew :phonecando-linux:testLiteDebugUnitTest   # Full and Play variants too
```

See `testing.md` for the test layers and CI.
