# LRE rules — read before touching `lre/`

`lre/` is the Linux runtime engine, a separate build owned by PhoneCanDo.
PhoneCanDo is its only consumer and owns the roadmap; keep the runtime free
of app and Android types. Every rule here is a quality gate, not a style
preference. File paths are from the repo root, or from a module's source
dir where the module is named; `run/` and `files/` paths are on the phone
(an image's dir and the app's `filesDir`).

## 1. Product boundary

The LRE owns:

- unpacking base layers into a rootfs (`tar`)
- pulling linux/arm64 images from registries and the Docker Hub catalog
  (`oci`)
- image setup, the per-start refresh, reset and delete; detection, fixups,
  shims and every file under an image's `run/` (`image`)
- the on-disk image layout (`api` `ImageLayout`)
- the launcher and the `launch.conf` contract (`lre/launcher/`)
- the proot build (`lre/proot/`) and the Default image build
  (`lre/images/default/`)

The host app owns:

- `app/modules/phonecando-linux/`: env and image records
  (`files/state/envs.json`, `images.json`), jobs and progress events,
  locks, ids, the Android `HostEnv` (lib dir, data-dir spellings, DNS),
  the build-channel gate (`LinuxGate`), terminal recipes, the process
  reaper (`ImageReaper`), stable error codes for JS (`LinuxErrorCode`), the
  CMake build of the launcher and the packaging of proot and the image
- `app/modules/phonecando-runner/`: engines, their supervisor and the
  engine reaper by `PHONECANDO_AGENT`; it reads an image's `run/engine.env`
  and `run/os-note.md` directly (`engine/image/ImageDir.kt`) and never
  depends on `lre/`
- `app/src/engine/linux/`, `app/src/state/`, the Env tab and first launch:
  every flow and every screen

If a change needs `android.*`, a Context, an Expo or React Native type, a
record the UI shows, or an engine or agent concept, it does not belong in
`lre/`.

## 2. Dependency law

```
api <- tar
api <- oci
api + tar <- image
oci + image <- cli
```

- Every module is pure JVM (Kotlin, JDK 17 toolchain). No `android.*`, no
  `org.json`, no app packages.
- `image` never imports `oci`. A host composes a download (`oci`) with a
  setup (`image`); the Android host does, and so does `cli`.
- `cli` is a leaf: nothing depends on it, it is not published and not
  shipped. It exists so CI runs the phone's exact setup code.
- No reverse edges, no cycles. The build files are the law: a module sees
  only what its `build.gradle.kts` declares. Add a module to
  `settings.gradle.kts` only with real code and a green build.
- `api` vs `implementation` must be right: `image` exposes `api` and `tar`
  types, `oci` keeps kotlinx.serialization internal.
- Outside dependencies stay few and permissive: XZ for Java (0BSD, `tar`)
  and kotlinx-serialization-json (Apache-2.0, `oci`, `cli`) today.

## 3. Errors

- Every expected failure is a typed `LreException` subclass
  (`api` `LreException.kt`): unsafe entry, too large, bad reference, no
  space, digest mismatch, network, rate limited, not found, no arm64,
  unsupported layer or manifest, no shell, corrupt, cancelled. Local disk
  errors stay `IOException`.
- A failure message names the thing, never a secret: URLs go through
  `redactUrl` (no user info, query or fragment) before they reach an
  error.
- A new `LreException` subclass is an app change too: the host's
  `LinuxErrorCode.ofLre` is exhaustive, so the app build fails until the
  subclass has a code there and in `app/src/engine/linux/types.ts`. `cli`
  derives its code (`no_arm64`) from the class name.
- Long jobs take a `ProgressSink` and a `CancelSignal` and check the signal
  between units of work; cancelling throws `LreException.Cancelled`.

## 4. On-disk contracts

- `ImageLayout` (`api`) is the one description of
  `files/images/<id>/`. The runner reads its own copy of the parts it needs
  (`ImageDir.kt`); change both in one change.
- The `run/` files other code reads: `launch.conf` (the launcher; contract
  `lre/launcher/src/conf.h`), `engine.env` (the runner, the host's guest
  runner, `cli`), `os-note.md` (the runner) and `reinstall.txt` (the host,
  through `ReinstallList`). Everything else under `run/` is `image`'s own.
- `launch.conf`: `image`'s `conf/LaunchConf.kt` writes it,
  `lre/launcher/src/conf.c` reads it. A directive change updates `conf.h`,
  `conf.c`/`plan.c`, `lre/launcher/test/`, `LaunchConf.kt`/`Directive.kt`
  and `LaunchConfTest` together. `.github/ci/lre-image/launch-conf.sh` is a
  hand-written stand-in for the Default image's Tier 1 run; keep it in
  step.
- `engine.env`: `KEY=VALUE` lines, no quotes, no expansion; a value never
  holds a line break or NUL.
- We are pre-release: change a contract cleanly on every side at once. No
  migrations, no legacy readers, no compatibility shims.

## 5. Setup and guest files

- Every setup step is idempotent and recorded in `run/setup-state`; a killed
  setup resumes at the step that failed. A new step goes into `SetupStep`
  in order and must be safe to rerun.
- Nothing from an image reaches outside its root: tar paths are parsed and
  checked (`EntryPath`), symlinks are resolved guest-side (`GuestRoot`,
  `GuestFs`), writes replace a symlink instead of following it
  (`TextFiles`), deletes never cross one (`TreeDeleter`).
- Detect from the image itself (config, os-release, binaries on the guest
  PATH). Never a hand-kept table of distros; the one table is package
  families (`family/Families.kt`), and an unknown family still works.
- Commands always run as proot's fake root. Values from an image config
  pass `ImageEnv`'s filter; `LD_*`, `PROOT_*`, `PHONECANDO_*` and the
  session variables we set are never taken from an image.
- Secrets the engine holds never reach a guest: `LaunchConf.UNSET`.
- The per-start refresh stays cheap: write a file only when its content
  changes, re-detect by file checks, redo fixups only on a change.
- Pure parts stay pure (`conf/`, `family/`, `detect/` parsing, record
  codec, `FakeProc`, `NetFiles`) and are unit-tested without a filesystem
  where possible.

## 6. Launcher and payloads

- The launcher is clean-room C. Never Termux code in our own code; nothing
  copied from projects without a verified licence.
- `conf.c`, `plan.c` and `relay.c` are pure: no IO, no allocation.
  `main.c` and `standin.c` are the IO. The launcher forks proot once and
  stands in for the command: it returns when the command ends, with its
  status, while proot traces what the command left running
  (`--status-fd`, our proot patch). Every error prints
  `phonecando-launch: <reason>` and exits 127.
- The launcher and proot ship as a pair: a launcher change that needs a
  new proot option lands with the patch, and the staged proot is rebuilt
  (`lre/proot/stage.sh`) before an APK is built with that launcher.
- Everything a phone executes ships from the APK's native-library dir as
  `lib*.so` (`api` `PayloadNames`). Every ELF we build is 16 KB page
  aligned.
- proot is a third-party payload built from pinned sources
  (`lre/proot/pins.env`): every download is sha256-verified before use, a
  bump edits URL, sha256 and version together, and the build stays
  reproducible. The loader stays unbundled. Staged libs are never
  committed.
- Patches to proot live in `lre/proot/patches/` with a header that says why
  and when to drop them.

## 7. Default image

- Same inputs, same bytes: `lre/images/default/pins.env` plus its
  `recipe/` decide the image, and any change to them names a new version
  (`lre/images/default/inputs.sh`).
- Only a green `lre-image.yml` run on prod publishes, as the prerelease
  `linux-image-<version>`, never marked latest (the app updater reads
  `releases/latest`).
- The APK ships only the image `lock.json` names (`./manage image lock
  <run-id>`, then commit `lock.json`). A local image goes to
  `app/modules/phonecando-linux/android/src/linux/dev-assets/` and only
  debug builds carry it.

## 8. Licences

- Our code is under the repo licence (`LICENSE`); `lre/proot/` is MIT
  (`lre/proot/LICENSE`), except `talloc/memset_explicit.c` (talloc's
  LGPL-3.0-or-later).
- proot (GPL-2.0-or-later) and talloc (LGPL-3.0-or-later) are downloaded,
  never stored here. Every app release that ships `libproot.so` attaches
  `phonecando-proot-<version>-source.tar.gz`
  (`lre/proot/source-tarball.sh`).
- Each Default image release carries the exact Debian source packages of
  what it installs (`lre/images/default/gpl/`).
- A new shipped component, or a version bump of one, updates
  `THIRD_PARTY_NOTICES.md` and `app/src/ui/common/licenses.ts` together;
  `.github/ci/js/check-licenses.mjs` reads the pins and build files.

## 9. Testing

- Every non-trivial branch has a test. Pure logic is tested in JVM tests;
  fixtures are recorded responses and tiny synthetic trees, not real
  downloads.
- `cd lre && ./gradlew build` is green before a change is done.
- Launcher changes: `bash lre/launcher/test/run.sh`, and with a host proot
  build `bash lre/launcher/test/proot-test.sh <proot-dir> <rootfs>`.
- proot changes: `build-android.sh` + `verify.sh`, and the glibc build
  booting a rootfs and running `proot-test.sh` (`proot.yml`).
- Default image changes: `verify.py` and Tier 1 (`lre-image.yml`).
- Setup, detection, fixups and launch changes: Tier 2 (`lre-compat.yml`),
  one registry image per package family.
- No claim about proot on a phone without device logs or pixels.
- `LRE_LIVE=1` turns on the live Docker Hub test; it spends one anonymous
  pull, so it is off by default.

## 10. CI path filters

`lre.yml`, `proot.yml`, `lre-image.yml`, `lre-compat.yml` and `android.yml`
run only for the `paths:` they list. When a change gives a build or check a
new input (a new module or folder, a script reading a new file, a new
packaged asset), add that path to every workflow it feeds, in the same
change. See `lre/docs/guides/testing.md` for which workflow guards what.

## 11. Workflow

- Never run git commands. The user owns git; use file tools and report.
- One concern per commit-sized change. Update `lre/docs/planning/todo.md`
  when scope or status changes, and the module doc when a contract moves.
- Run the narrowest test first, then `./gradlew build`.
- Do not add a feature, option or abstraction nobody asked for. The
  smallest complete change wins.

## Review checklist

- [ ] Does every module stay pure JVM, free of `android.*`, `org.json` and
      app types, with no new edge outside the law?
- [ ] Are expected failures typed `LreException`s, and do new subclasses
      have a host and JS code?
- [ ] Did a contract change (`ImageLayout`, `run/` files, `conf.h`) update
      every reader and writer, tests and the CI stand-in?
- [ ] Is every setup step still idempotent and resumable?
- [ ] Can anything from an image or registry reach outside the image root
      or leak a secret?
- [ ] Are pins sha256-verified and builds reproducible?
- [ ] Did a new input get added to the workflows' `paths:`?
- [ ] Did `lre/docs/planning/todo.md` and the module doc get updated?
