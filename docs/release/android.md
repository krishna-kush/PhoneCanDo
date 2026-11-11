# Android releases (GitHub, no store)

PhoneCanDo ships signed APKs from public GitHub releases. Set
`GITHUB_REPO=<owner>/PhoneCanDo` to the repo that hosts them. The app checks
`releases/latest/download/latest.json` on launch and offers the update; Android
still shows its installer (one tap). Play is not involved.

Each release carries two APKs with the same version string.
`phonecando-<ver>-lite-arm64.apk` is the site download: no accessibility
service, so Play Protect lets a browser install it.
`phonecando-<ver>-full-arm64.apk` is the full build and the `latest.json`
target: lite offers it on first launch and installs it in place (measured in
`upgrade-test.md`).

Version codes: full gets the bumped `android.versionCode` (2, 3, ...); lite is
always 1. Any full therefore replaces any lite, and no lite can ever replace
an installed full (Android refuses the downgrade). Settings → About shows the
channel, so "0.1.2 · lite" and "0.1.2 · full" are told apart by name, not by
code. The `play` channel is a later feature; nothing is released from it.

Everything below runs through `./manage release <version> ...` from the repo
root, which fills in the env defaults.

## One-time: the release key

The release key (path in `PHONECANDO_STORE_FILE`) is the app's identity. Every
future update must be signed with it; losing it forces every user to uninstall
(data loss). Back it up in two places, offline.

Passwords live in the repo-root `.env`: gitignored, mode 600, never
committed; `.env.example` lists its keys. `./manage` and
`scripts/build-android.mjs` read it by default (set `PHONECANDO_RELEASE_ENV`
to use another file). The Gradle plugin `app/plugins/withReleaseSigning.js`
reads:

```
PHONECANDO_STORE_FILE      (path to the release keystore)
PHONECANDO_STORE_PASSWORD
PHONECANDO_KEY_ALIAS       (default: phonecando)
PHONECANDO_KEY_PASSWORD
```

Debug builds keep the debug keystore; only `release` uses this key.

## Release

Prerequisites:

- The repo-root `.env` holds the signing settings (or `PHONECANDO_RELEASE_ENV`
  points to another file).
- `GITHUB_REPO=owner/PhoneCanDo`.
- `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) points to the Android SDK.
- `gh auth login` has been run for the release repo.
- What you release is committed, pushed and through CI: the script releases
  exactly `HEAD` and refuses anything else (step 1).
- Full and lite ship Linux, so both payloads are staged: proot with
  `lre/proot/stage.sh <dir>` (a local build after `lre/proot/verify.sh`, or
  the unzipped `proot-android-arm64` CI artifact) and the locked Default image
  with `./manage image fetch && ./manage image stage`. `./manage release`
  handles proot itself first (`lre/proot/ensure.sh`): it uses a staged build
  of the current `lre/proot` or, after asking, builds and stages one with the
  pinned NDK. A release without them needs `--without-linux` (step 1).

Preview, then release as a draft:

```sh
node scripts/release-android.mjs --version 0.1.2 --notes "What changed." --dry-run
node scripts/release-android.mjs --version 0.1.2 --notes "What changed."
```

The script:

1. Runs the preflight before writing or building anything
   (`scripts/release/`). It only reads: `git rev-parse HEAD`,
   `git status --porcelain`, `gh auth status`, `gh api` GETs, the staged
   Linux files and `lre/images/default/lock/check.sh --locked --remote` (curl
   GETs). It prints a table of the checks on the commit and refuses the
   release when:
   - The working tree has any change, untracked files included. This is
     checked before the script bumps the version files, so its own bump never
     counts. `--upload-only` allows exactly those three files to differ
     (`app/app.json`, `app/package.json`, `app/src/engine/updates.ts`).
   - GitHub does not have the commit (`repos/<repo>/commits/<sha>` answers
     404 or 422): push it first.
   - CI on the commit is not green. These block when they failed, were
     cancelled or have not finished (queued, running, or their workflow is
     still running): `ci-ok` and `lint-ok`, which must exist (they run on
     every push, so a missing one means CI has not run); `web-ok`, `pce-ok`,
     `tce-ok`, `lre-ok` and `proot-ok` when their workflow ran; and every
     `android.yml` job that ran (PTY host test, prebuild, the debug APKs,
     the release shape, the lite emulator smoke on API 36).
   - Only a warning: a workflow that did not run for the commit (its path
     filters skipped it; GitHub also skips path filters silently when a push
     changes more than 300 files), `upstream-drift` (red until the opencode
     pin moves), `Release downloads` (red after a version bump until that
     release is published; `web-ok` red only because of it warns too), the
     experimental emulator legs (full on API 36, lite on API 29), report-only
     jobs (`Android lint`, the lint jobs marked "report only",
     `html-validate`, ...), CodeQL, Security, Scorecard, other apps and
     commit statuses. When a workflow ran more than once on the commit (a
     nightly run), its newest run counts.
   - proot (`app/modules/phonecando-linux/android/src/linux/libs/arm64-v8a/`)
     is not the verified build: `libproot.so` or `libproot-loader.so` missing
     or empty, no `SHA256SUMS` next to them (`stage.sh` copies the one
     `verify.sh` wrote after its ELF checks) or a lib that differs from it,
     or a `libproot.so` not built as the `PROOT_VERSION` in
     `lre/proot/pins.env` (a stale stage). We do not rebuild here (that needs
     the NDK); `proot.yml` proves the build is reproducible.
   - The Default image (`src/linux/assets/default-image/`) is not the one
     `lre/images/default/lock.json` locks: lock.json locks nothing,
     `check.sh --locked --remote` fails (the lock's fields; its
     `linux-image-<version>` release is a published prerelease, not latest,
     holding the image and a manifest that names this sha256, version and
     run), `image.json` or `rootfs.tar.xz` carry another sha256 or size,
     `image.json` says `"local": true` (a `stage --local` build), the lock's
     `lre-image.yml` run did not conclude success, or that release lacks the
     image's GPL source bundle (`...-sources-NN.tar` and
     `...-sources-index.tsv`). A local image in `dev-assets/` is only noted:
     release builds never carry it.
   - proot or the image is not staged at all. `--without-linux` allows that,
     and full and lite then ship without it; whatever is staged is still
     checked.

   `--allow-red-ci` releases despite red CI and ends the GitHub release
   notes with `Released with red CI: <checks>` (not the notes in
   `latest.json`, which the update dialog shows). It never skips the tree,
   the pushed or the Linux checks. `--dry-run` runs the preflight too and
   exits non-zero when a real run would stop there; it also lists the Linux
   checks and assets a real run would make, without packing the source
   tarball, and says whether its pinned downloads are cached or a real run
   downloads them first. The rules live in `scripts/release/ci/policy.mjs`
   (a new gated workflow gets its line there) and `scripts/release/linux/`.

   When proot ships, it then asks GitHub how many changes `termux/proot`'s
   default branch has after our pin (`lre/proot/pins.env`). If any, it says
   so in red with a link to them and asks `Release with this proot anyway?
   [y/N]`; anything but y stops the release, and so does a run without a
   terminal to ask. `--dry-run` only prints the warning; `--upload-only`
   skips it (the first run answered). A GitHub that can't be read is only
   noted. Bumping the pin is its own change (`lre/docs/modules/proot.md`).

   The Default image works the same way. With none locked, the preflight
   refuses full and lite and says to publish one first (`gh workflow run
   lre-image.yml --ref prod -f publish=true`, then `./manage image lock
   <run-id>`). With one locked, it prints in yellow how old its Debian
   packages are and the run that publishes a fresh one (`-f fresh=true`),
   and asks `Release with this Default image? [y/N]`, with the same rules
   for y, no terminal, `--dry-run` and `--upload-only`.
2. Checks the GitHub release: `gh release view v<version>`. A version whose
   release is already published is refused; an existing draft is fine.
   `--dry-run` skips this.
3. When proot ships, packs its GPL corresponding source,
   `phonecando-proot-<PROOT_VERSION>-source.tar.gz`, with
   `lre/proot/source-tarball.sh` (workdir `dist/release/proot-source/`; the
   pinned proot and talloc downloads are fetched there once and reused) and
   stages it in `dist/release/v<version>/`. The pack is deterministic: when
   an earlier run already staged one, the fresh pack must be byte-identical,
   or the release stops (`lre/proot` changed since; compare, then delete the
   staged copy). This runs before the version bump, so a failed download
   leaves no edited files.
4. Bumps `app/app.json` (`expo.version`, `android.versionCode`) and
   `app/package.json`, and sets the repo in `app/src/engine/updates.ts`.
5. Runs `expo prebuild -p android --no-install --no-clean` once (the
   channels are flavors of one project; without `--no-clean` Expo CLI
   regenerates `app/android`, which `--clean` asks for explicitly), then
   builds both flavors in one
   Gradle run, `assembleFullRelease assembleLiteRelease` (arm64 only), with
   the signing env sourced.
6. Audits both APKs before staging either (`scripts/apk-audit.mjs`, which
   `./manage build` uses too): signed by the release certificate (SHA-256
   `f334c389…fd75a0`; set `PHONECANDO_RELEASE_CERT_SHA256` after a key
   rotation), never the Android debug key; package, version and versionCode;
   channel meta-data; full declares the accessibility service and carries its
   class and the PCE classes, lite has neither; both carry non-empty
   `lib/arm64-v8a/liboc-engine.so` and `liboc-opentui.so`. Then the Linux
   entries (`scripts/release/linux/apk.mjs`): both carry
   `lib/arm64-v8a/libproot.so`, `libproot-loader.so` and
   `assets/default-image/{rootfs.tar.xz,image.json}` byte for byte as the
   preflight checked them, and no other Linux entry (none at all with
   `--without-linux` and nothing staged). A check that cannot run (missing
   tool, unreadable APK) fails.
7. Stages `dist/release/v<version>/phonecando-<version>-full-arm64.apk`,
   `phonecando-<version>-lite-arm64.apk` and `latest.json` (size and SHA-256
   of the staged full APK; gitignored), plus `source-commit`, the commit the
   APKs were built from.
8. Creates a **draft** GitHub release with the APKs, `latest.json` and,
   when proot ships, its source tarball. Its tag targets
   the preflight's commit (`--target <sha>`), so publishing creates the tag on
   exactly the commit the build started from (the version bump the build
   carries is committed afterwards, on top of it). If a draft for the tag
   already exists, it replaces the assets with `--clobber` and moves the
   target to that commit.
9. Only after every upload succeeded, writes `web/src/data/release.json`
   whole (repo, version, date, and the size and SHA-256 of both uploaded
   APKs; the site's computer commands check the full one). Nothing else
   writes that file, so hand edits to `site.ts` never collide with a release.
   The site takes its version from `app/app.json` and derives every download
   URL and file name from it; a production web build fails if
   `release.json` belongs to another version.

If an upload fails after the builds (GitHub times out on 110 MB assets now
and then), do not rebuild: `./manage release <version> --upload-only`
re-audits both staged APKs (their Linux entries against what is staged now
included), rewrites the size and SHA-256 in `latest.json`
from the staged full APK (its version, versionCode, URL and notes stay; a
different `--notes` is refused), packs proot's source again (step 3: it must
equal the staged copy, or is staged when there is none), re-uploads
everything with `--clobber` using those
notes, then writes `release.json`; add `--publish` to publish. It runs the
preflight on the commit in `source-commit` (or `HEAD` when the stage has
none), with the three bumped version files allowed, and tags that commit.

The Default image's GPL sources are not app-release assets: they stay in its
own `linux-image-<version>` release, which the preflight checks for them.

If a build fails after the version bump, the bumped version files are
uncommitted changes, and outside `--upload-only` the preflight refuses them.
Commit and push any fix, then either restore the three version files (the
script writes them again) or commit them with the fix, and rerun the same
command. The script keeps the same version/versionCode when the version is
unchanged. Its git use is read-only, so commit the version/site changes
yourself after the release.

Publish the draft after checking it:

```sh
gh release edit v0.1.2 --draft=false -R "$GITHUB_REPO"
```

Or pass `--publish` to the script to publish immediately after both assets are
attached.

`latest.json` shape:

```json
{
  "versionCode": 3,
  "version": "0.1.2",
  "apk": "https://github.com/<owner>/PhoneCanDo/releases/download/v0.1.2/phonecando-0.1.2-full-arm64.apk",
  "size": 111871491,
  "sha256": "<sha256>",
  "notes": "What changed."
}
```

Do not tick "pre-release" while alpha; put "alpha" in the title instead.
`/releases/latest` ignores drafts and pre-releases. Attach both assets before
publishing so the stable URL never serves a partial release.

## Test the update path

Debug builds run the same update check and show the dialog, but refuse the
install: a dev build is its own package (`com.phonecando.app.<channel>.dev`,
debug key), so the release APK could never update it. Test with two signed
releases:

1. Uninstall the old debug-signed app once (`adb uninstall com.phonecando.app`;
   app data is wiped), then install `v0.1.0` (`adb install -r ...`).
2. Publish `v0.1.1` with a higher `versionCode`.
3. Open 0.1.0: dialog → Update → download → Android installer → Install.
   Reopen: Settings → About shows `v0.1.1 (2)`.
4. Cancel the installer once and confirm "Install" retries without downloading
   again. With "Install unknown apps" off for PhoneCanDo, confirm the app's
   own "One quick OK from Android" step opens the right settings screen and
   that the install starts by itself on return.

Known friction: Play Protect hard-blocks the full APK from a browser or file
manager in most markets ("App blocked to protect your device", no "Install
anyway") because it declares an accessibility service. Lite is not blocked.
Whether lite can install full in place is measured in `upgrade-test.md`. There are no delta updates — each update is the full ~107 MB APK.
Release builds allow cleartext only to `127.0.0.1`/`localhost` (the pair UI and
opencode); everything else keeps Android's TLS-only default.

## Update-speed rules

- App knowledge: signed packs (`mobile_pack refresh`), no APK.
- opencode/PCE/native, UI, terminal, IME: new APK.
- A broken release cannot fetch its own fix; keep the website APK as the
  manual escape hatch.
