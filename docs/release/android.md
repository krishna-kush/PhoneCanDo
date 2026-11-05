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

Passwords live in a private env file outside the repo (mode 600; never commit
it). Set `PHONECANDO_RELEASE_ENV` to its path. The Gradle plugin
`app/plugins/withReleaseSigning.js` reads:

```
PHONECANDO_STORE_FILE      (path to the release keystore)
PHONECANDO_STORE_PASSWORD
PHONECANDO_KEY_ALIAS       (default: phonecando)
PHONECANDO_KEY_PASSWORD
```

Debug builds keep the debug keystore; only `release` uses this key.

## Release

Prerequisites:

- `PHONECANDO_RELEASE_ENV` points to the private env file.
- `GITHUB_REPO=owner/PhoneCanDo`.
- `ANDROID_HOME` (or `ANDROID_SDK_ROOT`) points to the Android SDK.
- `gh auth login` has been run for the release repo.

Preview, then release as a draft:

```sh
node scripts/release-android.mjs --version 0.1.2 --notes "What changed." --dry-run
node scripts/release-android.mjs --version 0.1.2 --notes "What changed."
```

The script:

1. Checks GitHub before building or writing anything: `gh auth status` and
   `gh release view v<version>`. A version whose release is already
   published is refused; an existing draft is fine. `--dry-run` skips these
   checks and stays offline.
2. Bumps `app/app.json` (`expo.version`, `android.versionCode`) and
   `app/package.json`, and sets the repo in `app/src/engine/updates.ts`.
3. Runs `expo prebuild -p android --no-install --no-clean` once (the
   channels are flavors of one project; without `--no-clean` Expo CLI 57
   regenerates `app/android`, which `--clean` asks for explicitly), then
   builds both flavors in one
   Gradle run, `assembleFullRelease assembleLiteRelease` (arm64 only), with
   the signing env sourced.
4. Audits both APKs before staging either (`scripts/apk-audit.mjs`, which
   `./manage build` uses too): signed by the release certificate (SHA-256
   `f334c389…fd75a0`; set `PHONECANDO_RELEASE_CERT_SHA256` after a key
   rotation), never the Android debug key; package, version and versionCode;
   channel meta-data; full declares the accessibility service and carries its
   class and the PCE classes, lite has neither; both carry non-empty
   `lib/arm64-v8a/libopencode2.so` and `libopentui.so`. A check that cannot
   run (missing tool, unreadable APK) fails.
5. Stages `dist/release/v<version>/phonecando-<version>-full-arm64.apk`,
   `phonecando-<version>-lite-arm64.apk` and `latest.json` (size and SHA-256
   of the staged full APK; gitignored).
6. Creates a **draft** GitHub release with all three assets. If a draft for
   the tag already exists, it replaces the assets with `--clobber`.
7. Only after every upload succeeded, updates the `published` block in
   `web/src/data/site.ts` (version, date, lite size, lite SHA-256). The site
   takes its version from `app/app.json` and derives every download URL and
   file name from it; a production web build fails if the `published` block
   belongs to another version.

If an upload fails after the builds (GitHub times out on 110 MB assets now
and then), do not rebuild: `./manage release <version> --upload-only`
re-audits both staged APKs, rewrites the size and SHA-256 in `latest.json`
from the staged full APK (its version, versionCode, URL and notes stay; a
different `--notes` is refused), re-uploads with `--clobber` using those
notes, then updates `site.ts`; add `--publish` to publish.

If a build fails after the version bump, fix it and rerun the same command. The
script keeps the same version/versionCode when the version is unchanged. It
does not run git, so commit the version/site changes yourself.

Publish the draft after checking it:

```sh
gh release edit v0.1.2 --draft=false -R "$GITHUB_REPO"
```

The repo must already have at least one commit: GitHub cannot create a release
tag in an empty repo. With `--publish`, the script checks this before building.

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
