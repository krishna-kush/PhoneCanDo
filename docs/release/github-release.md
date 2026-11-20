# Releasing from GitHub Actions

A release can be built on your computer (`./manage release <ver>`, see
`android.md`) or on GitHub's runners:

```sh
./manage release 1.0.0 --via-github --notes "What's new, for the update dialog"
```

Both run `scripts/release-android.mjs` with the same checks (clean tree,
pushed commit, CI, proot, the Default image, the agent payloads, every APK
check), so they produce the same release. The GitHub one uploads nothing
big from your computer.

It needs, set up once on GitHub: a `release` environment (you as required
reviewer, `prod` only) holding the secrets `PHONECANDO_STORE_BASE64` (the
keystore, base64), `PHONECANDO_STORE_PASSWORD`, `PHONECANDO_KEY_ALIAS` and
`PHONECANDO_KEY_PASSWORD`, and Actions allowed to create pull requests.

| | Built here | Built on GitHub |
|---|---|---|
| Command | `./manage release <ver>` | `./manage release <ver> --via-github` |
| Upload from your computer | both APKs (about 380 MB) | none |
| Time | about 20 min (incremental) | about 30-40 min, plus your approval |
| The changed files | left in your tree to commit | a pull request to merge |
| Retry a failed upload | `--upload-only` | Re-run failed jobs |
| Build attestation | none | both APKs (`gh attestation verify`) |

## How it runs

`.github/workflows/release.yml`, started by hand on `prod` only, runs three
jobs:

1. **`build`**, no secrets: stages what an APK ships the way a local release
   does (opencode from CI's build of its pins, proot built from its pins,
   llama-server from CI's build of its pins through
   `.github/ci/release/stage-llama-server.sh`, the Default image from its
   lock), then `release-android.mjs --sign-later`: the preflight, the build
   and every APK check but the signer, with the debug key signing for now.
2. **`sign`**, in the `release` environment, so it waits for your approval:
   `release-android.mjs --sign-staged` re-signs both APKs with the release
   key, checks the release certificate is their only signer and uploads the
   draft. It installs no packages: only our scripts, Node, `apksigner` and
   `gh` run while the key is on the runner, and the key is deleted after.
   With the key gone, GitHub's `actions/attest` attests both signed APKs: their SHA-256,
   signed for this run, its workflow and its commit, so anyone can check a
   download with `gh attestation verify <apk> --repo <owner/repo>`.
   Once the draft has them, it deletes `build`'s debug-signed APKs (the
   `release-staged` artifact), which anyone signed in to GitHub could
   otherwise download for a day.
3. **`pr`**: commits `app/app.json`, `app/package.json`,
   `app/src/engine/updates/manifest.ts` and `web/src/data/release.json` (both APKs'
   size and sha256) to `release/v<ver>` and opens a pull request to `prod`.

## Release from GitHub

1. Push what you release. You need not wait for CI: `build` waits for it
   (up to 45 minutes, while nothing is red) before it builds, and stops at
   the first red check.
2. `./manage release 1.0.0 --via-github --notes "..."`. It takes `--notes`,
   `--label alpha|beta`, `--allow-red-ci` and `--publish`, and refuses the flags only a local build has (`--dry-run`,
   `--upload-only`, `--without-linux`, `--clean`). The same inputs are on
   the Actions tab (Release → Run workflow).
3. When `build` is done, approve `sign` on the run's page (`./manage`
   prints its link and follows the run).
4. Test the draft's APKs (`gh release download v1.0.0`), publish it
   (`gh release edit v1.0.0 --draft=false`), then merge the pull request:
   the merge deploys the site with the new version and hashes.

A local release asks before it ships the Default image (how old its
packages are) or a proot behind upstream. GitHub has no terminal to ask, so
the workflow always passes `--accept-all`: those questions are answered yes,
and what they would ask still prints in its log.

## When it fails

- **Missing secret:** the Release key step names it.
- **No llama-server build:** CI keeps them 14 days; run `llamacpp.yml` on
  `prod`, then release again.
- **Preflight refused:** the same reasons as a local release, in the log.
- **Signing, the upload or the pull request failed:** Re-run failed jobs on
  the run's page; `build` is not run again (its output is kept a day).
- **The build failed:** start the release again. A failed run never
  publishes; a new one replaces the draft's files and the pull request's
  branch.
