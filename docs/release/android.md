# Android releases (GitHub, no store)

PhoneCanDo ships signed APKs from public GitHub releases. Set
`GITHUB_REPO=<owner>/PhoneCanDo` to the repo that hosts them. The app checks
`releases/latest/download/latest.json` on launch and offers the update; Android
still shows its installer (one tap). Play is not involved.

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

1. Bumps `app/app.json` (`expo.version`, `android.versionCode`) and
   `app/package.json`.
2. Runs `expo prebuild -p android --clean`, then `assembleRelease` (arm64 only)
   with the signing env sourced.
3. Verifies the APK with `apksigner` and `aapt`, rejects the Android debug
   signer, then computes size and SHA-256.
4. Stages `dist/release/v<version>/phonecando-<version>-arm64.apk` and
   `latest.json` (gitignored).
5. Updates `web/src/data/site.ts` (version, date, size, SHA-256, APK URL) and
   `app/src/engine/updates.ts` (repo).
6. Creates a **draft** GitHub release with both assets. If a draft for the tag
   already exists, it replaces the assets with `--clobber`.

If a build fails after the version bump, fix it and rerun the same command. The
script keeps the same version/versionCode when the version is unchanged; a
published release with that tag is refused. It does not run git, so commit the
version/site changes yourself.

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
  "apk": "https://github.com/<owner>/PhoneCanDo/releases/download/v0.1.2/phonecando-0.1.2-arm64.apk",
  "size": 111871491,
  "sha256": "<sha256>",
  "notes": "What changed."
}
```

Do not tick "pre-release" while alpha; put "alpha" in the title instead.
`/releases/latest` ignores drafts and pre-releases. Attach both assets before
publishing so the stable URL never serves a partial release.

## Test the update path

The updater is skipped in `__DEV__` (debug builds are debug-signed). Test with
two signed releases:

1. Uninstall the old debug-signed app once (`adb uninstall com.phonecando.app`;
   app data is wiped), then install `v0.1.0` (`adb install -r ...`).
2. Publish `v0.1.1` with a higher `versionCode`.
3. Open 0.1.0: dialog → Update → download → Android installer → Install.
   Reopen: Settings → About shows `v0.1.1 (2)`.
4. Cancel the installer once and confirm "Install" retries without downloading
   again. Deny "install unknown apps" and confirm "Open install settings"
   recovers.

Known friction: Play Protect may scan/warn on sideloaded APKs; the user taps
through. There are no delta updates — each update is the full ~107 MB APK.
Release builds allow cleartext only to `127.0.0.1`/`localhost` (the pair UI and
opencode); everything else keeps Android's TLS-only default.

## Update-speed rules

- App knowledge: signed packs (`mobile_pack refresh`), no APK.
- opencode/PCE/native, UI, terminal, IME: new APK.
- A broken release cannot fetch its own fix; keep the website APK as the
  manual escape hatch.
