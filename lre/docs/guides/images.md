# Default image: build, publish, lock, stage

What the image is and how its build works: `../modules/default-image.md`.
The full and lite APKs carry it as
`app/modules/phonecando-linux/android/src/linux/assets/default-image/`
(`rootfs.tar.xz` and `image.json`), stored, not deflated. That dir is
gitignored: the image is staged, never committed. Play carries none.

```
./manage image build            -> dist/images/local/          (docker, unlocked)
./manage image stage --local    -> src/linux/dev-assets/       (debug builds only)

lre-image.yml on prod           -> release linux-image-<version> (prerelease, never latest)
./manage image lock <run-id>    -> lre/images/default/lock.json (you commit it)
./manage image fetch            -> dist/images/<asset>          (sha256 + size checked)
./manage image stage            -> src/linux/assets/            (every full and lite build)
```

## Build one locally

```bash
./manage image build
python3 -I lre/images/default/verify.py dist/images/local
```

`./manage image build` runs `lre/images/default/build.sh dist/images/local`
with the pins in `pins.env`. It needs docker and jq; on an x86_64 host the
arm64 image runs under qemu-user binfmt and takes 15 to 20 minutes.
`XZ_THREADS` (default nproc, at most 4) changes speed, not bytes;
`KEEP_TAR=1` also keeps the uncompressed `rootfs.tar`.

For the newest `debian:trixie` digest and today's snapshot, call the
script yourself (needs `docker buildx`):

```bash
bash lre/images/default/build.sh dist/images/local --fresh
bash lre/images/default/inputs.sh --fresh    # just print the new pins
```

A bump edits `pins.env` (or `recipe/`) in one change; either names a new
version.

## Try it in a debug build

```bash
./manage image stage --local
```

`lock/stage.sh --local` takes the one build manifest in
`dist/images/local`, checks the image's sha256 and size against it and
copies it to
`app/modules/phonecando-linux/android/src/linux/dev-assets/default-image/`
with `"local": true` and no release in `image.json`. Only the `fullDebug`
and `liteDebug` variants carry `dev-assets/`, and there it wins over a
locked image; no release APK can carry it. Rebuild the app
(`pnpm android:<channel>`) to pick it up. Remove it with:

```bash
rm -r app/modules/phonecando-linux/android/src/linux/dev-assets/default-image
```

If Gradle reports the asset merge up to date with an empty output after
the first staging, rerun it from `app/android`:
`./gradlew :phonecando-linux:mergeFullDebugAssets --rerun`
(`../../../app/docs/context.md`).

## Publish

Only `lre-image.yml` publishes, only on prod and only when started by hand
with `publish`; `fresh` builds from the newest Debian and today's snapshot
instead of `pins.env`:

```bash
gh workflow run lre-image.yml --ref prod -f publish=true               # pins.env
gh workflow run lre-image.yml --ref prod -f publish=true -f fresh=true # newer packages
```

Every
check must be green first: both builds the same bytes, `verify.py`,
Tier 1 and the GPL sources. The `publish` job then creates the prerelease
`linux-image-<version>`, never marked latest (the app updater reads
`releases/latest`), with:

- `phonecando-linux-default-<version>-arm64.tar.xz` and its `.sha256`
- `phonecando-linux-default-<version>.json` — the build manifest plus the
  release, the run (id, attempt, url, commit) and the source assets
- `phonecando-linux-default-<version>-packages.tsv`
- the GPL source bundle: `phonecando-linux-default-<version>-sources-NN.tar`
  parts (each under 2 GiB) and `-sources-index.tsv`

The same tag published again must have the same sha256. A fresh publish
whose base digest, recipe and package versions equal the newest published
image's publishes nothing: only the date in its version would differ. The
weekly run
builds and tests fresh inputs but never publishes: a red one says a fresh
publish would fail. `./manage release` refuses full and lite until an image
is locked, and then shows how old it is and asks before it builds.

## Lock

```bash
./manage image lock <run-id>
```

`lock/lock.sh` refuses a run that is not `lre-image.yml` on prod,
completed green, with a successful `publish` job. It finds that run's
`linux-image-*` release, checks the manifest and the asset, rewrites
`lock.json` and checks it with `check.sh --locked --remote`; on failure
`lock.json` stays as it was. It needs `gh` (logged in) and jq, and only
reads from GitHub. Commit `lre/images/default/lock.json` yourself.

```bash
bash lre/images/default/lock/check.sh            # valid, or nothing locked
bash lre/images/default/lock/check.sh --locked   # nothing locked is an error (exit 3)
bash lre/images/default/lock/check.sh --remote   # also ask GitHub, read-only
```

## Fetch and stage

```bash
./manage image fetch && ./manage image stage
```

`lock/fetch.sh` downloads the locked asset into `dist/images/` over plain
HTTPS (no login) and checks sha256 and size; a verified copy already there
is kept. `lock/stage.sh` checks the file against `lock.json` again and
installs it with `image.json` (version, sha256, size, release, Debian
digest, snapshot) into `src/linux/assets/default-image/`. Both exit 3 while
nothing is locked. `android.yml`'s release-shape build does the same when
`lock.json` locks an image.

## Releases of the app

`./manage release` checks that the staged image is exactly the one
`lock.json` names, from a green run whose release holds the GPL sources
(`scripts/release/linux/image.mjs`), and that proot is staged and verified
(`../modules/proot.md`). Without both, full and lite do not ship unless
you pass `--without-linux`. A local image is refused for a release like any
image the lock does not name.

GPL sources: each `linux-image-<version>` release carries the image's
exact Debian source packages; every app release that ships `libproot.so`
attaches `phonecando-proot-<version>-source.tar.gz`
(`../../../THIRD_PARTY_NOTICES.md`).
