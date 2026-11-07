# proot

Our build of Termux's proot fork, the third-party payload that runs every
guest command. Only the build scripts live here; proot and talloc sources
are downloaded at pinned versions and sha256-verified before use.

Files: `lre/proot/`.

| File | Role |
|---|---|
| `pins.env` | Every pinned input: termux/proot commit, version and archive sha256; talloc version, URL, mirror and sha256; Android API (29) and NDK (r28c); the Alpine minirootfs for CI smoke tests. Plain `KEY=value`, no expansion; CI reads it too. |
| `build-android.sh` | Android arm64 build (bionic, NDK clang): `libproot.so` and `libproot-loader.so`, stripped. |
| `build-glibc.sh` | The same sources and layout for the Linux host (any arch proot supports), so CI can run images on plain Linux. |
| `verify.sh` | ELF checks of the Android build, then `SHA256SUMS` (written only when every check passes). |
| `stage.sh` | Copies a verified build into the app module's jniLibs. |
| `source-tarball.sh` | The GPL corresponding source, one deterministic `.tar.gz`. |
| `steps/` | Sourced pieces: `sources.sh` (pins, fetch, unpack, patches), `talloc.sh`, `proot.sh`. |
| `talloc/` | Our talloc `config.h` and `memset_explicit.c`. |
| `patches/` | Our patches to proot, applied in name order with `patch -p1`. |

## What we build

- termux/proot at the commit in `pins.env` (`PROOT_VERSION` is what
  `proot --version` prints), with upstream's makefile and the CPPFLAGS
  termux-packages uses.
- **Loader unbundled** (`PROOT_UNBUNDLE_LOADER`): bundled, proot writes the
  loader to `PROOT_TMP_DIR` and execs it there, which Android's W^X forbids
  for app data. Unbundled, proot execs `$PROOT_LOADER`, shipped as
  `libproot-loader.so` beside it. With `PROOT_LOADER` unset it tries
  `/PROOT_LOADER-unset/loader` and the guest never starts.
- **No 32-bit loader**: we ship arm64 guests only; a 32-bit guest binary
  fails to exec.
- **talloc static**, compiled directly from `talloc.c` with our
  `talloc/config.h` instead of its waf build (waf needs python and
  cross-answers, and builds parts proot never uses); a `libtalloc.so.2`
  SONAME cannot ship as an Android jniLib.
- **Reproducible**: build paths never reach the binaries
  (`-ffile-prefix-map`), `VERSION` comes from `pins.env`, never from git,
  and CI builds twice in different workdirs and compares bytes.
- Hardening (Android build): stack protector and fortify for proot, not
  for the freestanding loader; 16 KB page alignment for both.
- `patches/0001-ashmem_memfd-include-string.h.patch` adds a missing
  `<string.h>` that a stock NDK clang treats as an error; its header says
  when to drop it.

## Runtime contract

proot needs `PROOT_LOADER=<libDir>/libproot-loader.so` and
`PROOT_TMP_DIR=<a writable app dir>`; `launch.conf` also sets
`PROOT_L2S_DIR` for `--link2symlink`. All three come from `image`'s
`LaunchConf.kt` (`run/proot-tmp/`, `run/l2s/`).

## Build, verify, stage

From the repo root:

```bash
ANDROID_NDK_HOME=<ndk r28c> bash lre/proot/build-android.sh <workdir> <out-dir>
bash lre/proot/verify.sh <out-dir>     # markdown table; SHA256SUMS on success
bash lre/proot/stage.sh <out-dir>      # -> app/modules/phonecando-linux/android/src/linux/libs/arm64-v8a/
```

- `build-android.sh` refuses an NDK other than the pinned one and paths
  with spaces. `<workdir>/downloads` is the verified download cache and is
  reused; the build trees are rebuilt every run.
- `verify.sh` checks, without running anything (no CI runner can exec
  bionic): both files ELF64 AArch64 with every LOAD segment aligned to
  16 KB; `libproot.so` a PIE with `/system/bin/linker64` as INTERP, only
  `libc`, `libm`, `libdl`, `liblog` as NEEDED, and the unbundled-loader
  marker; `libproot-loader.so` a static EXEC with no INTERP and no NEEDED,
  by design (`../../../app/docs/context.md` → the proot loader has no
  INTERP).
- `stage.sh` takes a dir with a matching `SHA256SUMS` (a verified build, or
  the unzipped `proot-android-arm64` artifact of a `proot.yml` run) and
  copies both libs (0755) and `SHA256SUMS` into the module's jniLibs dir,
  which is gitignored. Full and lite package it; play does not.

The release preflight (`scripts/release/linux/proot.mjs`) checks the staged
libs against that `SHA256SUMS` and `pins.env`'s version; a release refuses
to ship full and lite without them unless told `--without-linux`.

## Host build

```bash
bash lre/proot/build-glibc.sh <workdir> <out-dir>
PROOT_LOADER=<out-dir>/libproot-loader.so PROOT_TMP_DIR=<dir> \
  <out-dir>/libproot.so -0 -r <rootfs> -w / /bin/sh
```

CI boots the pinned Alpine aarch64 minirootfs under it on
`ubuntu-24.04-arm` (`.github/ci/proot/smoke.sh`): version, fake root, the
app's flags, no start without `PROOT_LOADER`, nothing executable left in
`PROOT_TMP_DIR`. `lre-image.yml` and `lre-compat.yml` run their images
under this build.

## GPL source

```bash
bash lre/proot/source-tarball.sh <workdir> <out-file>
```

`phonecando-proot-<PROOT_VERSION>-source/` holds `SOURCES.txt`, both
pinned downloads byte for byte and `lre/proot/` itself. Deterministic:
sorted names, mtime `PROOT_COMMIT_DATE`, owner 0:0, fixed modes, `gzip -n`.
Every app release that ships `libproot.so` attaches it
(`scripts/release/linux/source.mjs`).

## Licence

`lre/proot/LICENSE`: our scripts, pins, patches and talloc config are MIT;
`talloc/memset_explicit.c` is part of the talloc build and under talloc's
LGPL-3.0-or-later. proot is GPL-2.0-or-later and talloc
LGPL-3.0-or-later; neither is stored here. See
`../../../THIRD_PARTY_NOTICES.md`.

## CI

`proot.yml` (`proot-ok`): `build-android` (build, verify, upload
`proot-android-arm64`, then a second build in another workdir must be
bit-identical), `build-glibc` (build and smoke test), `source` (pack twice,
same bytes). It runs on `lre/proot/**` changes, weekly and on demand, and
never touches a release.
